-- Enum additions must commit before later migrations use the new value.
alter type public.task_tracker_status add value if not exists 'completed';

alter table public.task_tracker_items
  add column if not exists completed_at timestamptz;
