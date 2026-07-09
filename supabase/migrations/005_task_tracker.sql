-- Client-facing calendar tasks are intentionally separate from roadmap tasks.
-- Actioning an item links it to the documentation and roadmap records created
-- by the application orchestration layer.

do $$ begin
  create type public.task_tracker_priority as enum (
    'urgent', 'high', 'medium', 'low'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.task_tracker_status as enum (
    'pending', 'actioning', 'actioned', 'failed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.task_tracker_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  input_text text not null,
  title text not null,
  description text not null,
  priority public.task_tracker_priority not null default 'medium',
  scheduled_for date not null,
  due_on date,
  estimate_minutes integer,
  documentation_update text not null,
  roadmap_description text not null,
  roadmap_planning_prompt text not null,
  roadmap_implementation_prompt text not null,
  roadmap_validation_gate text not null,
  status public.task_tracker_status not null default 'pending',
  documentation_node_id uuid references public.documentation_nodes (id) on delete set null,
  roadmap_task_id uuid references public.roadmap_tasks (id) on delete set null,
  action_error text,
  lock_version integer not null default 1,
  actioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_tracker_title_not_blank check (length(btrim(title)) > 0),
  constraint task_tracker_description_not_blank check (length(btrim(description)) > 0),
  constraint task_tracker_documentation_not_blank
    check (length(btrim(documentation_update)) > 0),
  constraint task_tracker_roadmap_description_not_blank
    check (length(btrim(roadmap_description)) > 0),
  constraint task_tracker_planning_prompt_not_blank
    check (length(btrim(roadmap_planning_prompt)) > 0),
  constraint task_tracker_implementation_prompt_not_blank
    check (length(btrim(roadmap_implementation_prompt)) > 0),
  constraint task_tracker_validation_gate_not_blank
    check (length(btrim(roadmap_validation_gate)) > 0),
  constraint task_tracker_input_length check (length(input_text) <= 4000),
  constraint task_tracker_title_length check (length(title) <= 200),
  constraint task_tracker_description_length check (length(description) <= 4000),
  constraint task_tracker_documentation_length
    check (length(documentation_update) <= 20000),
  constraint task_tracker_roadmap_field_lengths check (
    length(roadmap_description) <= 4000
    and length(roadmap_planning_prompt) <= 20000
    and length(roadmap_implementation_prompt) <= 20000
    and length(roadmap_validation_gate) <= 20000
  ),
  constraint task_tracker_estimate_positive
    check (estimate_minutes is null or estimate_minutes > 0),
  constraint task_tracker_dates_ordered
    check (due_on is null or due_on >= scheduled_for),
  constraint task_tracker_action_state check (
    (status = 'actioned' and documentation_node_id is not null
      and roadmap_task_id is not null and actioned_at is not null)
    or status <> 'actioned'
  )
);

create index if not exists task_tracker_calendar_idx
  on public.task_tracker_items (project_id, scheduled_for, priority, created_at);

create unique index if not exists task_tracker_documentation_link_key
  on public.task_tracker_items (documentation_node_id, id)
  where documentation_node_id is not null;

create unique index if not exists task_tracker_roadmap_link_key
  on public.task_tracker_items (roadmap_task_id)
  where roadmap_task_id is not null;

create or replace function public.version_task_tracker_item()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.lock_version = old.lock_version + 1;
  return new;
end;
$$;

drop trigger if exists task_tracker_items_version on public.task_tracker_items;
create trigger task_tracker_items_version
  before update on public.task_tracker_items
  for each row execute function public.version_task_tracker_item();

-- The application uses this for each durable checkpoint in the docs -> roadmap
-- pipeline. Optimistic locking prevents two Action clicks from running at once.
create or replace function public.update_task_tracker_action(
  p_item_id uuid,
  p_expected_lock_version integer,
  p_status public.task_tracker_status,
  p_documentation_node_id uuid,
  p_roadmap_task_id uuid,
  p_action_error text
)
returns setof public.task_tracker_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.task_tracker_items;
begin
  update public.task_tracker_items
  set status = p_status,
      documentation_node_id = p_documentation_node_id,
      roadmap_task_id = p_roadmap_task_id,
      action_error = p_action_error,
      actioned_at = case
        when p_status = 'actioned' then coalesce(actioned_at, now())
        else actioned_at
      end
  where id = p_item_id and lock_version = p_expected_lock_version
  returning * into v_item;

  if v_item.id is null then return; end if;
  return next v_item;
end;
$$;

alter table public.task_tracker_items enable row level security;

drop policy if exists "task_tracker_items_read" on public.task_tracker_items;
create policy "task_tracker_items_read" on public.task_tracker_items
  for select using (true);

drop policy if exists "task_tracker_items_insert" on public.task_tracker_items;
create policy "task_tracker_items_insert" on public.task_tracker_items
  for insert with check (true);

revoke all on function public.update_task_tracker_action(
  uuid, integer, public.task_tracker_status, uuid, uuid, text
) from public;
grant execute on function public.update_task_tracker_action(
  uuid, integer, public.task_tracker_status, uuid, uuid, text
) to anon, authenticated;
