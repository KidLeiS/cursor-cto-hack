-- Keep the public hackathon documentation surface bounded even when clients use
-- Supabase REST directly instead of the validated application API.

do $$ begin
  alter table public.documentation_nodes
    add constraint documentation_nodes_slug_length check (length(slug) <= 120);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.documentation_nodes
    add constraint documentation_nodes_title_length check (length(title) <= 160);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.documentation_nodes
    add constraint documentation_nodes_markdown_length check (length(markdown) <= 500000);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.documentation_nodes
    add constraint documentation_nodes_metadata_length
      check (length(canvas_metadata::text) <= 10000);
exception when duplicate_object then null;
end $$;
