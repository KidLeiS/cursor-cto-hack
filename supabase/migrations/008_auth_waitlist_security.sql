-- Production access boundary: one approved user, waitlist-only signup,
-- project membership RLS, and per-user MCP credentials.

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'owner'
    check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  key_prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null default array['mcp:read', 'mcp:write'],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (scopes <@ array['mcp:read', 'mcp:write'])
);

create index if not exists mcp_api_keys_active_prefix_idx
  on public.mcp_api_keys(key_prefix)
  where revoked_at is null;
create index if not exists mcp_api_keys_owner_idx
  on public.mcp_api_keys(user_id, project_id, created_at desc);

create table if not exists public.mcp_audit_events (
  id bigint generated always as identity primary key,
  key_id uuid references public.mcp_api_keys(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  tool_name text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_request_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_request_attempts_window_idx
  on public.auth_request_attempts(email_hash, ip_hash, created_at desc);

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'eric@aimalcolm.com';
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_allowed_user()
    and exists (
      select 1
      from public.project_members member
      where member.project_id = p_project_id
        and member.user_id = auth.uid()
        and lower(member.email) = 'eric@aimalcolm.com'
    );
$$;

revoke all on function public.is_allowed_user() from public;
revoke all on function public.is_project_member(uuid) from public;
grant execute on function public.is_allowed_user() to authenticated, service_role;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;

create or replace function public.handle_restricted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) <> 'eric@aimalcolm.com' then
    raise exception 'Signups are waitlist-only';
  end if;

  insert into public.project_members(project_id, user_id, email, role)
  select project.id, new.id, lower(new.email), 'owner'
  from public.projects project
  where project.slug = 'cursor-cto-hack'
  on conflict (project_id, user_id) do update
    set email = excluded.email, role = 'owner';
  return new;
end;
$$;

drop trigger if exists restrict_auth_user on auth.users;
create trigger restrict_auth_user
  after insert or update of email on auth.users
  for each row execute function public.handle_restricted_auth_user();
revoke all on function public.handle_restricted_auth_user() from public, anon, authenticated;

-- Backfill membership when the owner account already exists.
insert into public.project_members(project_id, user_id, email, role)
select project.id, auth_user.id, lower(auth_user.email), 'owner'
from public.projects project
join auth.users auth_user
  on lower(auth_user.email) = 'eric@aimalcolm.com'
where project.slug = 'cursor-cto-hack'
on conflict (project_id, user_id) do update
  set email = excluded.email, role = 'owner';

-- Remove every hackathon-era permissive policy.
drop policy if exists "projects_all" on public.projects;
drop policy if exists "modules_all" on public.modules;
drop policy if exists "features_all" on public.features;
drop policy if exists "gates_all" on public.gates;
drop policy if exists "agent_runs_all" on public.agent_runs;
drop policy if exists "workplans_all" on public.workplans;
drop policy if exists "workplan_steps_all" on public.workplan_steps;
drop policy if exists "debug_cases_all" on public.debug_cases;
drop policy if exists "documentation_nodes_all" on public.documentation_nodes;
drop policy if exists "documentation_nodes_read" on public.documentation_nodes;
drop policy if exists "documentation_nodes_insert" on public.documentation_nodes;
drop policy if exists "documentation_revisions_read" on public.documentation_revisions;
drop policy if exists "documentation_assets_all" on public.documentation_assets;
drop policy if exists "documentation_assets_read" on public.documentation_assets;
drop policy if exists "documentation_assets_insert" on public.documentation_assets;
drop policy if exists "roadmap_tasks_read" on public.roadmap_tasks;
drop policy if exists "roadmap_task_dependencies_read" on public.roadmap_task_dependencies;
drop policy if exists "task_tracker_items_read" on public.task_tracker_items;
drop policy if exists "task_tracker_items_insert" on public.task_tracker_items;
drop policy if exists "projects_member" on public.projects;
drop policy if exists "modules_member" on public.modules;
drop policy if exists "features_member" on public.features;
drop policy if exists "gates_member" on public.gates;
drop policy if exists "agent_runs_member" on public.agent_runs;
drop policy if exists "workplans_member" on public.workplans;
drop policy if exists "workplan_steps_member" on public.workplan_steps;
drop policy if exists "debug_cases_member" on public.debug_cases;
drop policy if exists "documentation_nodes_member" on public.documentation_nodes;
drop policy if exists "documentation_revisions_member" on public.documentation_revisions;
drop policy if exists "documentation_assets_member" on public.documentation_assets;
drop policy if exists "roadmap_tasks_member" on public.roadmap_tasks;
drop policy if exists "roadmap_dependencies_member" on public.roadmap_task_dependencies;
drop policy if exists "task_tracker_items_member" on public.task_tracker_items;
drop policy if exists "project_members_self" on public.project_members;

alter table public.waitlist_entries enable row level security;
alter table public.project_members enable row level security;
alter table public.mcp_api_keys enable row level security;
alter table public.mcp_audit_events enable row level security;
alter table public.auth_request_attempts enable row level security;

create policy "projects_member" on public.projects for all
  using (public.is_project_member(id))
  with check (public.is_project_member(id));
create policy "modules_member" on public.modules for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "features_member" on public.features for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "gates_member" on public.gates for all
  using (exists (
    select 1 from public.features feature
    where feature.id = gates.feature_id
      and public.is_project_member(feature.project_id)
  ))
  with check (exists (
    select 1 from public.features feature
    where feature.id = gates.feature_id
      and public.is_project_member(feature.project_id)
  ));
create policy "agent_runs_member" on public.agent_runs for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "workplans_member" on public.workplans for all
  using (exists (
    select 1 from public.agent_runs run
    where run.id = workplans.agent_run_id
      and public.is_project_member(run.project_id)
  ))
  with check (exists (
    select 1 from public.agent_runs run
    where run.id = workplans.agent_run_id
      and public.is_project_member(run.project_id)
  ));
create policy "workplan_steps_member" on public.workplan_steps for all
  using (exists (
    select 1
    from public.workplans plan
    join public.agent_runs run on run.id = plan.agent_run_id
    where plan.id = workplan_steps.workplan_id
      and public.is_project_member(run.project_id)
  ))
  with check (exists (
    select 1
    from public.workplans plan
    join public.agent_runs run on run.id = plan.agent_run_id
    where plan.id = workplan_steps.workplan_id
      and public.is_project_member(run.project_id)
  ));
create policy "debug_cases_member" on public.debug_cases for all
  using (exists (
    select 1 from public.agent_runs run
    where run.id = debug_cases.agent_run_id
      and public.is_project_member(run.project_id)
  ))
  with check (exists (
    select 1 from public.agent_runs run
    where run.id = debug_cases.agent_run_id
      and public.is_project_member(run.project_id)
  ));

create policy "documentation_nodes_member" on public.documentation_nodes for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "documentation_revisions_member" on public.documentation_revisions for select
  using (exists (
    select 1 from public.documentation_nodes node
    where node.id = documentation_revisions.node_id
      and public.is_project_member(node.project_id)
  ));
create policy "documentation_assets_member" on public.documentation_assets for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "roadmap_tasks_member" on public.roadmap_tasks for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "roadmap_dependencies_member"
  on public.roadmap_task_dependencies for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "task_tracker_items_member" on public.task_tracker_items for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));
create policy "project_members_self" on public.project_members for select
  using (user_id = auth.uid() and public.is_allowed_user());

-- Internal credential, audit, rate-limit, cleanup, and waitlist tables have no
-- authenticated/anonymous policies. Only service_role may access them.

drop policy if exists "documentation_assets_storage_read" on storage.objects;
drop policy if exists "documentation_assets_storage_insert" on storage.objects;
drop policy if exists "documentation_assets_storage_delete" on storage.objects;
drop policy if exists "documentation_assets_storage_member" on storage.objects;
create policy "documentation_assets_storage_member" on storage.objects for all
  using (
    bucket_id = 'documentation-assets'
    and exists (
      select 1 from public.project_members member
      where member.user_id = auth.uid()
        and public.is_project_member(member.project_id)
        and name like member.project_id::text || '/%'
    )
  )
  with check (
    bucket_id = 'documentation-assets'
    and exists (
      select 1 from public.project_members member
      where member.user_id = auth.uid()
        and public.is_project_member(member.project_id)
        and name like member.project_id::text || '/%'
    )
  );

-- Security-definer mutation RPCs are server-only. This prevents arbitrary
-- authenticated accounts from bypassing RLS through an owner-executed function.
do $$
declare
  routine regprocedure;
begin
  for routine in
    select procedure.oid::regprocedure
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'update_documentation_content',
        'move_documentation_node',
        'delete_documentation_node',
        'archive_documentation_asset',
        'queue_documentation_storage_cleanup',
        'version_documentation_node',
        'create_roadmap_task',
        'update_roadmap_task',
        'delete_roadmap_task',
        'update_task_tracker_action',
        'update_task_tracker_item',
        'reschedule_task_tracker_item',
        'complete_task_tracker_item',
        'delete_task_tracker_item'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', routine);
    execute format('grant execute on function %s to service_role', routine);
  end loop;
end;
$$;

revoke all on table public.waitlist_entries from anon, authenticated;
revoke all on table public.mcp_api_keys from anon, authenticated;
revoke all on table public.mcp_audit_events from anon, authenticated;
revoke all on table public.auth_request_attempts from anon, authenticated;
grant all on table public.waitlist_entries to service_role;
grant all on table public.mcp_api_keys to service_role;
grant all on table public.mcp_audit_events to service_role;
grant all on table public.auth_request_attempts to service_role;
grant usage, select on all sequences in schema public to service_role;
