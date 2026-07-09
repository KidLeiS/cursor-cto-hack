-- Editable documentation tree, revision history, and image metadata.
-- Markdown stays in Postgres; image bytes stay in the private Supabase Storage bucket.

create table if not exists public.documentation_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  parent_id uuid,
  slug text not null,
  title text not null,
  markdown text not null default '',
  sort_order integer not null default 0,
  canvas_x double precision not null default 0,
  canvas_y double precision not null default 0,
  canvas_width double precision,
  canvas_height double precision,
  canvas_metadata jsonb not null default '{}'::jsonb,
  content_version integer not null default 1,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, id),
  constraint documentation_nodes_parent_fk
    foreign key (project_id, parent_id)
    references public.documentation_nodes (project_id, id)
    on delete restrict,
  constraint documentation_nodes_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint documentation_nodes_title_not_blank
    check (length(btrim(title)) > 0),
  constraint documentation_nodes_not_own_parent
    check (parent_id is null or parent_id <> id),
  constraint documentation_nodes_canvas_width_positive
    check (canvas_width is null or canvas_width > 0),
  constraint documentation_nodes_canvas_height_positive
    check (canvas_height is null or canvas_height > 0),
  constraint documentation_nodes_metadata_object
    check (jsonb_typeof(canvas_metadata) = 'object')
);

-- PostgreSQL treats NULLs as distinct, so roots and children need separate indexes.
create unique index if not exists documentation_nodes_root_slug_key
  on public.documentation_nodes (project_id, slug)
  where parent_id is null;

create unique index if not exists documentation_nodes_child_slug_key
  on public.documentation_nodes (project_id, parent_id, slug)
  where parent_id is not null;

create index if not exists documentation_nodes_parent_order_idx
  on public.documentation_nodes (project_id, parent_id, sort_order, title);

create table if not exists public.documentation_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  node_id uuid not null,
  content_version integer not null,
  slug text not null,
  title text not null,
  markdown text not null,
  created_at timestamptz not null default now(),
  unique (node_id, content_version),
  constraint documentation_revisions_node_fk
    foreign key (project_id, node_id)
    references public.documentation_nodes (project_id, id)
    on delete cascade
);

create index if not exists documentation_revisions_node_version_idx
  on public.documentation_revisions (node_id, content_version desc);

create table if not exists public.documentation_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  node_id uuid not null,
  storage_bucket text not null default 'documentation-assets',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  alt_text text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path),
  constraint documentation_assets_node_fk
    foreign key (project_id, node_id)
    references public.documentation_nodes (project_id, id)
    on delete cascade,
  constraint documentation_assets_byte_size_valid
    check (byte_size > 0 and byte_size <= 10485760),
  constraint documentation_assets_image_mime
    check (mime_type in ('image/gif', 'image/jpeg', 'image/png', 'image/webp')),
  constraint documentation_assets_width_positive check (width is null or width > 0),
  constraint documentation_assets_height_positive check (height is null or height > 0)
);

create index if not exists documentation_assets_node_idx
  on public.documentation_assets (node_id, created_at);

-- Physical objects cannot be removed transactionally by a Postgres cascade.
-- Hard metadata deletion queues eventual Storage cleanup (for example when an
-- entire project is removed). User-facing image deletion only archives rows.
create table if not exists public.documentation_storage_cleanup_queue (
  id bigint generated always as identity primary key,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (storage_bucket, storage_path)
);

create or replace function public.queue_documentation_storage_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.documentation_storage_cleanup_queue (storage_bucket, storage_path)
  values (old.storage_bucket, old.storage_path)
  on conflict (storage_bucket, storage_path) do update set
    processed_at = null,
    last_error = null;
  return old;
end;
$$;

drop trigger if exists documentation_assets_queue_cleanup on public.documentation_assets;
create trigger documentation_assets_queue_cleanup
  after delete on public.documentation_assets
  for each row execute function public.queue_documentation_storage_cleanup();

-- Reject cycles even when a node is moved several levels at once.
create or replace function public.validate_documentation_parent()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select n.id, n.parent_id
      from public.documentation_nodes n
      where n.project_id = new.project_id and n.id = new.parent_id
      union all
      select n.id, n.parent_id
      from public.documentation_nodes n
      join ancestors a on n.id = a.parent_id
      where n.project_id = new.project_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A documentation node cannot be moved below itself'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists documentation_nodes_validate_parent on public.documentation_nodes;
create trigger documentation_nodes_validate_parent
  before insert or update of project_id, parent_id on public.documentation_nodes
  for each row execute function public.validate_documentation_parent();

-- Archive the old content and advance versions inside the database so every writer
-- (dashboard, agent, or REST client) follows the same concurrency/history rules.
create or replace function public.version_documentation_node()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  new.lock_version = old.lock_version + 1;

  if new.slug is distinct from old.slug
    or new.title is distinct from old.title
    or new.markdown is distinct from old.markdown then
    insert into public.documentation_revisions (
      project_id, node_id, content_version, slug, title, markdown, created_at
    ) values (
      old.project_id, old.id, old.content_version, old.slug, old.title,
      old.markdown, old.updated_at
    );
    new.content_version = old.content_version + 1;
  else
    new.content_version = old.content_version;
  end if;

  return new;
end;
$$;

drop trigger if exists documentation_nodes_version on public.documentation_nodes;
create trigger documentation_nodes_version
  before update on public.documentation_nodes
  for each row execute function public.version_documentation_node();

-- All updates use database-level compare-and-swap. Direct table updates are not
-- permitted by RLS, so REST clients cannot silently overwrite a newer version.
create or replace function public.update_documentation_content(
  p_node_id uuid,
  p_expected_lock_version integer,
  p_slug text,
  p_title text,
  p_markdown text
)
returns setof public.documentation_nodes
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.documentation_nodes
    set slug = p_slug, title = p_title, markdown = p_markdown
    where id = p_node_id and lock_version = p_expected_lock_version
    returning *;
end;
$$;

create or replace function public.move_documentation_node(
  p_node_id uuid,
  p_expected_lock_version integer,
  p_parent_id uuid,
  p_sort_order integer,
  p_canvas_x double precision,
  p_canvas_y double precision,
  p_canvas_width double precision default null,
  p_canvas_height double precision default null,
  p_canvas_metadata jsonb default '{}'::jsonb
)
returns setof public.documentation_nodes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  select project_id into v_project_id
  from public.documentation_nodes
  where id = p_node_id;
  if v_project_id is null then return; end if;

  -- Serialize hierarchy changes within a project. This closes the race where
  -- simultaneous inverse moves could each pass a cycle check.
  perform pg_advisory_xact_lock(hashtextextended(v_project_id::text, 0));

  return query
    update public.documentation_nodes
    set parent_id = p_parent_id,
        sort_order = p_sort_order,
        canvas_x = p_canvas_x,
        canvas_y = p_canvas_y,
        canvas_width = p_canvas_width,
        canvas_height = p_canvas_height,
        canvas_metadata = p_canvas_metadata
    where id = p_node_id and lock_version = p_expected_lock_version
    returning *;
end;
$$;

create or replace function public.delete_documentation_node(
  p_node_id uuid,
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
  delete from public.documentation_nodes
  where id = p_node_id and lock_version = p_expected_lock_version
  returning true into v_deleted;
  return coalesce(v_deleted, false);
end;
$$;

create or replace function public.archive_documentation_asset(p_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived boolean;
begin
  update public.documentation_assets
  set archived_at = coalesce(archived_at, now())
  where id = p_asset_id
  returning true into v_archived;
  return coalesce(v_archived, false);
end;
$$;

alter table public.documentation_nodes enable row level security;
alter table public.documentation_revisions enable row level security;
alter table public.documentation_assets enable row level security;
alter table public.documentation_storage_cleanup_queue enable row level security;

-- Match the existing hack/demo access model. Replace these with membership policies
-- when authentication is introduced.
drop policy if exists "documentation_nodes_all" on public.documentation_nodes;
drop policy if exists "documentation_nodes_read" on public.documentation_nodes;
create policy "documentation_nodes_read" on public.documentation_nodes
  for select using (true);
drop policy if exists "documentation_nodes_insert" on public.documentation_nodes;
create policy "documentation_nodes_insert" on public.documentation_nodes
  for insert with check (true);

drop policy if exists "documentation_revisions_read" on public.documentation_revisions;
create policy "documentation_revisions_read" on public.documentation_revisions
  for select using (true);

drop policy if exists "documentation_assets_all" on public.documentation_assets;
drop policy if exists "documentation_assets_read" on public.documentation_assets;
create policy "documentation_assets_read" on public.documentation_assets
  for select using (true);
drop policy if exists "documentation_assets_insert" on public.documentation_assets;
create policy "documentation_assets_insert" on public.documentation_assets
  for insert with check (true);

-- The cleanup queue is deliberately inaccessible to anonymous clients. A
-- service-role worker can read it (service_role bypasses RLS) and remove objects.

revoke all on function public.update_documentation_content(uuid, integer, text, text, text)
  from public;
revoke all on function public.move_documentation_node(
  uuid, integer, uuid, integer, double precision, double precision,
  double precision, double precision, jsonb
) from public;
revoke all on function public.delete_documentation_node(uuid, integer) from public;
revoke all on function public.archive_documentation_asset(uuid) from public;

grant execute on function public.update_documentation_content(uuid, integer, text, text, text)
  to anon, authenticated;
grant execute on function public.move_documentation_node(
  uuid, integer, uuid, integer, double precision, double precision,
  double precision, double precision, jsonb
) to anon, authenticated;
grant execute on function public.delete_documentation_node(uuid, integer)
  to anon, authenticated;
grant execute on function public.archive_documentation_asset(uuid)
  to anon, authenticated;

-- Supabase Storage is the binary layer. The bucket is private; callers receive
-- short-lived signed URLs rather than permanent public links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentation-assets',
  'documentation-assets',
  false,
  10485760,
  array['image/gif', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documentation_assets_storage_read" on storage.objects;
create policy "documentation_assets_storage_read" on storage.objects
  for select using (bucket_id = 'documentation-assets');

drop policy if exists "documentation_assets_storage_insert" on storage.objects;
create policy "documentation_assets_storage_insert" on storage.objects
  for insert with check (bucket_id = 'documentation-assets');

drop policy if exists "documentation_assets_storage_delete" on storage.objects;
create policy "documentation_assets_storage_delete" on storage.objects
  for delete using (bucket_id = 'documentation-assets');
