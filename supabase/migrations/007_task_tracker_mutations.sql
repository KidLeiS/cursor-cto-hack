-- Product-manager mutations remain behind optimistic, security-definer RPCs.
-- Calendar completion is distinct from "actioned", which means the item has
-- been promoted into documentation and the roadmap.

do $$ begin
  alter table public.task_tracker_items
    add constraint task_tracker_completed_state check (
      (status = 'completed' and completed_at is not null)
      or status <> 'completed'
    );
exception when duplicate_object then null;
end $$;

create or replace function public.update_task_tracker_item(
  p_item_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_description text,
  p_priority public.task_tracker_priority,
  p_scheduled_for date,
  p_due_on date,
  p_estimate_minutes integer
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
  set title = p_title,
      description = p_description,
      priority = p_priority,
      scheduled_for = p_scheduled_for,
      due_on = p_due_on,
      estimate_minutes = p_estimate_minutes,
      action_error = null
  where id = p_item_id
    and lock_version = p_expected_lock_version
    and status in ('pending', 'failed')
  returning * into v_item;

  if v_item.id is null then return; end if;
  return next v_item;
end;
$$;

create or replace function public.reschedule_task_tracker_item(
  p_item_id uuid,
  p_expected_lock_version integer,
  p_scheduled_for date,
  p_due_on date
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
  set scheduled_for = p_scheduled_for,
      due_on = p_due_on,
      action_error = null
  where id = p_item_id
    and lock_version = p_expected_lock_version
    and status not in ('actioning', 'cancelled', 'completed')
  returning * into v_item;

  if v_item.id is null then return; end if;
  return next v_item;
end;
$$;

create or replace function public.complete_task_tracker_item(
  p_item_id uuid,
  p_expected_lock_version integer
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
  set status = 'completed',
      completed_at = now(),
      action_error = null
  where id = p_item_id
    and lock_version = p_expected_lock_version
    and status not in ('actioning', 'cancelled', 'completed')
  returning * into v_item;

  if v_item.id is null then return; end if;
  return next v_item;
end;
$$;

create or replace function public.delete_task_tracker_item(
  p_item_id uuid,
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
  delete from public.task_tracker_items
  where id = p_item_id
    and lock_version = p_expected_lock_version
    and status <> 'actioning'
  returning true into v_deleted;

  return coalesce(v_deleted, false);
end;
$$;

revoke all on function public.update_task_tracker_item(
  uuid, integer, text, text, public.task_tracker_priority, date, date, integer
) from public;
revoke all on function public.reschedule_task_tracker_item(
  uuid, integer, date, date
) from public;
revoke all on function public.complete_task_tracker_item(uuid, integer)
  from public;
revoke all on function public.delete_task_tracker_item(uuid, integer)
  from public;

grant execute on function public.update_task_tracker_item(
  uuid, integer, text, text, public.task_tracker_priority, date, date, integer
) to anon, authenticated;
grant execute on function public.reschedule_task_tracker_item(
  uuid, integer, date, date
) to anon, authenticated;
grant execute on function public.complete_task_tracker_item(uuid, integer)
  to anon, authenticated;
grant execute on function public.delete_task_tracker_item(uuid, integer)
  to anon, authenticated;
