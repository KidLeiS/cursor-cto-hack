-- Roadmap tasks use one adjacency-list model at every depth. Dependencies are
-- separate edges so a linear sequence can grow into a DAG without a migration.

do $$ begin
  create type public.roadmap_task_status as enum (
    'planned', 'ready', 'in_progress', 'validating',
    'done', 'blocked', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_task_id uuid,
  slug text not null,
  title text not null,
  description text,
  status public.roadmap_task_status not null default 'planned',
  progress_percent integer not null default 0,
  estimate_minutes integer,
  planning_prompt text not null,
  implementation_prompt text not null,
  validation_gate text not null,
  sort_order integer not null default 0,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  constraint roadmap_tasks_parent_fk
    foreign key (project_id, parent_task_id)
    references public.roadmap_tasks (project_id, id)
    on delete cascade,
  constraint roadmap_tasks_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint roadmap_tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint roadmap_tasks_planning_prompt_not_blank
    check (length(btrim(planning_prompt)) > 0),
  constraint roadmap_tasks_implementation_prompt_not_blank
    check (length(btrim(implementation_prompt)) > 0),
  constraint roadmap_tasks_validation_gate_not_blank
    check (length(btrim(validation_gate)) > 0),
  constraint roadmap_tasks_progress_range
    check (progress_percent between 0 and 100),
  constraint roadmap_tasks_estimate_positive
    check (estimate_minutes is null or estimate_minutes > 0),
  constraint roadmap_tasks_not_own_parent
    check (parent_task_id is null or parent_task_id <> id)
);

create unique index if not exists roadmap_tasks_root_slug_key
  on public.roadmap_tasks (project_id, slug)
  where parent_task_id is null;

create unique index if not exists roadmap_tasks_child_slug_key
  on public.roadmap_tasks (project_id, parent_task_id, slug)
  where parent_task_id is not null;

create index if not exists roadmap_tasks_parent_order_idx
  on public.roadmap_tasks (project_id, parent_task_id, sort_order, title);

create table if not exists public.roadmap_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  constraint roadmap_task_dependencies_task_fk
    foreign key (project_id, task_id)
    references public.roadmap_tasks (project_id, id)
    on delete cascade,
  constraint roadmap_task_dependencies_prerequisite_fk
    foreign key (project_id, depends_on_task_id)
    references public.roadmap_tasks (project_id, id)
    on delete cascade,
  constraint roadmap_task_dependencies_not_self
    check (task_id <> depends_on_task_id)
);

create index if not exists roadmap_task_dependencies_project_idx
  on public.roadmap_task_dependencies (project_id, task_id);

-- Parent links are containment, but must still remain acyclic.
create or replace function public.validate_roadmap_task_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select task.id, task.parent_task_id
      from public.roadmap_tasks task
      where task.project_id = new.project_id and task.id = new.parent_task_id
      union all
      select task.id, task.parent_task_id
      from public.roadmap_tasks task
      join ancestors ancestor on task.id = ancestor.parent_task_id
      where task.project_id = new.project_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A roadmap task cannot be moved below itself'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists roadmap_tasks_validate_parent on public.roadmap_tasks;
create trigger roadmap_tasks_validate_parent
  before insert or update of project_id, parent_task_id on public.roadmap_tasks
  for each row execute function public.validate_roadmap_task_parent();

-- Reject an edge when its prerequisite already reaches the dependent task.
create or replace function public.validate_roadmap_dependency()
returns trigger
language plpgsql
as $$
begin
  if exists (
    with recursive prerequisites as (
      select dependency.depends_on_task_id
      from public.roadmap_task_dependencies dependency
      where dependency.project_id = new.project_id
        and dependency.task_id = new.depends_on_task_id
      union
      select dependency.depends_on_task_id
      from public.roadmap_task_dependencies dependency
      join prerequisites prerequisite
        on dependency.task_id = prerequisite.depends_on_task_id
      where dependency.project_id = new.project_id
    )
    select 1 from prerequisites where depends_on_task_id = new.task_id
  ) then
    raise exception 'Roadmap task dependencies must form a DAG'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists roadmap_task_dependencies_validate
  on public.roadmap_task_dependencies;
create trigger roadmap_task_dependencies_validate
  before insert or update on public.roadmap_task_dependencies
  for each row execute function public.validate_roadmap_dependency();

create or replace function public.version_roadmap_task()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.lock_version = old.lock_version + 1;
  return new;
end;
$$;

drop trigger if exists roadmap_tasks_version on public.roadmap_tasks;
create trigger roadmap_tasks_version
  before update on public.roadmap_tasks
  for each row execute function public.version_roadmap_task();

-- Task and dependency-edge writes are atomic. Updates compare the caller's
-- version to avoid silently overwriting edits.
create or replace function public.create_roadmap_task(
  p_project_id uuid,
  p_parent_task_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_status public.roadmap_task_status,
  p_progress_percent integer,
  p_estimate_minutes integer,
  p_planning_prompt text,
  p_implementation_prompt text,
  p_validation_gate text,
  p_sort_order integer,
  p_dependency_ids uuid[] default '{}'::uuid[]
)
returns setof public.roadmap_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.roadmap_tasks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  insert into public.roadmap_tasks (
    project_id, parent_task_id, slug, title, description, status,
    progress_percent, estimate_minutes, planning_prompt, implementation_prompt,
    validation_gate, sort_order
  ) values (
    p_project_id, p_parent_task_id, p_slug, p_title, p_description, p_status,
    p_progress_percent, p_estimate_minutes, p_planning_prompt,
    p_implementation_prompt, p_validation_gate, p_sort_order
  )
  returning * into v_task;

  insert into public.roadmap_task_dependencies (
    project_id, task_id, depends_on_task_id
  )
  select p_project_id, v_task.id, dependency_id
  from (
    select distinct unnest(coalesce(p_dependency_ids, '{}'::uuid[])) as dependency_id
  ) dependencies;

  return next v_task;
end;
$$;

create or replace function public.update_roadmap_task(
  p_task_id uuid,
  p_expected_lock_version integer,
  p_parent_task_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_status public.roadmap_task_status,
  p_progress_percent integer,
  p_estimate_minutes integer,
  p_planning_prompt text,
  p_implementation_prompt text,
  p_validation_gate text,
  p_sort_order integer,
  p_dependency_ids uuid[] default '{}'::uuid[]
)
returns setof public.roadmap_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_task public.roadmap_tasks;
begin
  select project_id into v_project_id
  from public.roadmap_tasks
  where id = p_task_id;
  if v_project_id is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_project_id::text, 0));

  update public.roadmap_tasks
  set parent_task_id = p_parent_task_id,
      slug = p_slug,
      title = p_title,
      description = p_description,
      status = p_status,
      progress_percent = p_progress_percent,
      estimate_minutes = p_estimate_minutes,
      planning_prompt = p_planning_prompt,
      implementation_prompt = p_implementation_prompt,
      validation_gate = p_validation_gate,
      sort_order = p_sort_order
  where id = p_task_id and lock_version = p_expected_lock_version
  returning * into v_task;

  if v_task.id is null then return; end if;

  delete from public.roadmap_task_dependencies where task_id = p_task_id;
  insert into public.roadmap_task_dependencies (
    project_id, task_id, depends_on_task_id
  )
  select v_project_id, p_task_id, dependency_id
  from (
    select distinct unnest(coalesce(p_dependency_ids, '{}'::uuid[])) as dependency_id
  ) dependencies;

  return next v_task;
end;
$$;

create or replace function public.delete_roadmap_task(
  p_task_id uuid,
  p_expected_lock_version integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted boolean;
begin
  delete from public.roadmap_tasks
  where id = p_task_id and lock_version = p_expected_lock_version
  returning true into v_deleted;
  return coalesce(v_deleted, false);
end;
$$;

alter table public.roadmap_tasks enable row level security;
alter table public.roadmap_task_dependencies enable row level security;

drop policy if exists "roadmap_tasks_read" on public.roadmap_tasks;

drop policy if exists "roadmap_task_dependencies_read"
  on public.roadmap_task_dependencies;

revoke all on function public.create_roadmap_task(
  uuid, uuid, text, text, text, public.roadmap_task_status, integer, integer,
  text, text, text, integer, uuid[]
) from public;
revoke all on function public.update_roadmap_task(
  uuid, integer, uuid, text, text, text, public.roadmap_task_status,
  integer, integer, text, text, text, integer, uuid[]
) from public;
revoke all on function public.delete_roadmap_task(uuid, integer) from public;
grant execute on function public.create_roadmap_task(
  uuid, uuid, text, text, text, public.roadmap_task_status, integer, integer,
  text, text, text, integer, uuid[]
) to service_role;
grant execute on function public.update_roadmap_task(
  uuid, integer, uuid, text, text, text, public.roadmap_task_status,
  integer, integer, text, text, text, integer, uuid[]
) to service_role;
grant execute on function public.delete_roadmap_task(uuid, integer)
  to service_role;

-- Seed a deterministic linear roadmap. The same rows also power integration
-- environments, while the dashboard has an equivalent no-secrets fallback.
insert into public.roadmap_tasks (
  id, project_id, parent_task_id, slug, title, description, status,
  progress_percent, estimate_minutes, planning_prompt, implementation_prompt,
  validation_gate, sort_order
)
select
  '10000000-0000-4000-8000-000000000001'::uuid,
  project.id,
  null,
  'roadmap-foundation',
  'Build the roadmap foundation',
  'Deliver the first end-to-end roadmap backend and task experience.',
  'in_progress',
  48,
  600,
  'Design an incremental roadmap that reuses the existing Next.js and Supabase architecture.',
  'Implement the roadmap schema, API, task list, and task-detail dependency graph.',
  'All roadmap unit tests, endpoint tests, type checks, and the production build pass.',
  0
from public.projects project where project.slug = 'cursor-cto-hack'
on conflict (project_id, id) do nothing;

insert into public.roadmap_tasks (
  id, project_id, parent_task_id, slug, title, description, status,
  progress_percent, estimate_minutes, planning_prompt, implementation_prompt,
  validation_gate, sort_order
)
select seed.id, project.id, '10000000-0000-4000-8000-000000000001'::uuid,
  seed.slug, seed.title, seed.description, seed.status, seed.progress_percent,
  seed.estimate_minutes, seed.planning_prompt, seed.implementation_prompt,
  seed.validation_gate, seed.sort_order
from public.projects project
cross join (values
  (
    '10000000-0000-4000-8000-000000000002'::uuid,
    'model-roadmap-data',
    'Model roadmap data',
    'Create the shared task model and acyclic dependency edges.',
    'done'::public.roadmap_task_status,
    100,
    90,
    'Define one core model shared by tasks and subtasks, with explicit DAG edges.',
    'Add constrained PostgreSQL tables, optimistic locking, RLS, and seed data.',
    'Migration applies twice without errors and rejects hierarchy or dependency cycles.',
    0
  ),
  (
    '10000000-0000-4000-8000-000000000003'::uuid,
    'expose-task-api',
    'Expose the task API',
    'Provide list, detail, create, update, and delete endpoints.',
    'in_progress'::public.roadmap_task_status,
    65,
    180,
    'Specify stable JSON contracts and request validation for roadmap consumers.',
    'Implement Next.js route handlers backed by Supabase and the demo fallback.',
    'Endpoint tests cover successful reads and invalid mutation payloads.',
    1
  ),
  (
    '10000000-0000-4000-8000-000000000004'::uuid,
    'render-task-experience',
    'Render the task experience',
    'Show progress, remaining estimates, prompts, gates, and dependencies.',
    'ready'::public.roadmap_task_status,
    15,
    240,
    'Design an accessible task list and a readable left-to-right DAG.',
    'Build server-rendered task pages and a React Flow graph component.',
    'Seed tasks render at /tasks and every graph node exposes prompt and gate details.',
    2
  ),
  (
    '10000000-0000-4000-8000-000000000005'::uuid,
    'validate-roadmap',
    'Validate the roadmap',
    'Exercise domain rules, endpoints, types, and the production bundle.',
    'planned'::public.roadmap_task_status,
    0,
    90,
    'List failure modes for malformed graphs, invalid updates, and missing tasks.',
    'Add focused tests and execute the complete dashboard validation suite.',
    'Tests, typecheck, and next build all complete successfully.',
    3
  )
) as seed(
  id, slug, title, description, status, progress_percent, estimate_minutes,
  planning_prompt, implementation_prompt, validation_gate, sort_order
)
where project.slug = 'cursor-cto-hack'
on conflict (project_id, id) do nothing;

insert into public.roadmap_task_dependencies (
  id, project_id, task_id, depends_on_task_id
)
select seed.id, project.id, seed.task_id, seed.depends_on_task_id
from public.projects project
cross join (values
  (
    '20000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid
  ),
  (
    '20000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid
  ),
  (
    '20000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid
  )
) as seed(id, task_id, depends_on_task_id)
where project.slug = 'cursor-cto-hack'
on conflict (task_id, depends_on_task_id) do nothing;
