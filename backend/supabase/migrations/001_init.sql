-- Cursor CTO shared context (Option B) — idempotent for hackathon re-runs

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums (create if missing)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.feature_status as enum (
    'idea', 'planned', 'in_progress', 'validating', 'done', 'blocked'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gate_level as enum ('feature', 'subfeature', 'step');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gate_status as enum ('pending', 'pass', 'fail', 'skipped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.agent_kind as enum ('feature', 'debug');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.agent_run_status as enum (
    'queued', 'planning', 'implementing', 'validating',
    'succeeded', 'failed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.workplan_step_status as enum (
    'pending', 'ready', 'in_progress', 'done', 'blocked', 'skipped'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  repo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  slug text not null,
  name text not null,
  purpose text,
  public_api text,
  invariants text,
  depends_on text[] not null default '{}',
  readme_path text,
  map_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  slug text not null,
  title text not null,
  summary text,
  status public.feature_status not null default 'idea',
  frontend_notes text,
  backend_notes text,
  module_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table if not exists public.gates (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.features (id) on delete cascade,
  parent_gate_id uuid references public.gates (id) on delete cascade,
  level public.gate_level not null default 'feature',
  title text not null,
  criteria text not null,
  status public.gate_status not null default 'pending',
  evidence text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.agent_kind not null,
  status public.agent_run_status not null default 'queued',
  feature_id uuid references public.features (id) on delete set null,
  title text not null,
  intent text not null,
  harness text not null default 'cursor',
  external_run_url text,
  model_plan text,
  model_implement text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workplans (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null unique references public.agent_runs (id) on delete cascade,
  feature_id uuid references public.features (id) on delete set null,
  summary text not null,
  architecture_notes text,
  editable boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workplan_steps (
  id uuid primary key default gen_random_uuid(),
  workplan_id uuid not null references public.workplans (id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  implementation_plan text not null,
  validation_requirements text not null,
  target_module_ids uuid[] not null default '{}',
  status public.workplan_step_status not null default 'pending',
  gate_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debug_cases (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null unique references public.agent_runs (id) on delete cascade,
  symptom text not null,
  repro_steps text,
  suspected_modules uuid[] not null default '{}',
  failing_gate_ids uuid[] not null default '{}',
  root_cause text,
  fix_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists modules_updated_at on public.modules;
create trigger modules_updated_at before update on public.modules
  for each row execute function public.set_updated_at();

drop trigger if exists features_updated_at on public.features;
create trigger features_updated_at before update on public.features
  for each row execute function public.set_updated_at();

drop trigger if exists gates_updated_at on public.gates;
create trigger gates_updated_at before update on public.gates
  for each row execute function public.set_updated_at();

drop trigger if exists agent_runs_updated_at on public.agent_runs;
create trigger agent_runs_updated_at before update on public.agent_runs
  for each row execute function public.set_updated_at();

drop trigger if exists workplans_updated_at on public.workplans;
create trigger workplans_updated_at before update on public.workplans
  for each row execute function public.set_updated_at();

drop trigger if exists workplan_steps_updated_at on public.workplan_steps;
create trigger workplan_steps_updated_at before update on public.workplan_steps
  for each row execute function public.set_updated_at();

drop trigger if exists debug_cases_updated_at on public.debug_cases;
create trigger debug_cases_updated_at before update on public.debug_cases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: open for anon key in hack/demo; tighten with auth later
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.modules enable row level security;
alter table public.features enable row level security;
alter table public.gates enable row level security;
alter table public.agent_runs enable row level security;
alter table public.workplans enable row level security;
alter table public.workplan_steps enable row level security;
alter table public.debug_cases enable row level security;

drop policy if exists "projects_all" on public.projects;
create policy "projects_all" on public.projects for all using (true) with check (true);

drop policy if exists "modules_all" on public.modules;
create policy "modules_all" on public.modules for all using (true) with check (true);

drop policy if exists "features_all" on public.features;
create policy "features_all" on public.features for all using (true) with check (true);

drop policy if exists "gates_all" on public.gates;
create policy "gates_all" on public.gates for all using (true) with check (true);

drop policy if exists "agent_runs_all" on public.agent_runs;
create policy "agent_runs_all" on public.agent_runs for all using (true) with check (true);

drop policy if exists "workplans_all" on public.workplans;
create policy "workplans_all" on public.workplans for all using (true) with check (true);

drop policy if exists "workplan_steps_all" on public.workplan_steps;
create policy "workplan_steps_all" on public.workplan_steps for all using (true) with check (true);

drop policy if exists "debug_cases_all" on public.debug_cases;
create policy "debug_cases_all" on public.debug_cases for all using (true) with check (true);

-- Seed demo project
insert into public.projects (slug, name, repo_url)
values (
  'cursor-cto-hack',
  'Cursor CTO Hack',
  'https://github.com/KidLeiS/cursor-cto-hack'
)
on conflict (slug) do update set
  name = excluded.name,
  repo_url = excluded.repo_url;
