-- Starter documentation canvas. Stable IDs make this idempotent without
-- overwriting content that people edit after the first deployment.

insert into public.documentation_nodes (
  id, project_id, parent_id, slug, title, markdown, sort_order,
  canvas_x, canvas_y, canvas_width, canvas_height
)
select
  seed.id,
  project.id,
  seed.parent_id,
  seed.slug,
  seed.title,
  seed.markdown,
  seed.sort_order,
  seed.canvas_x,
  seed.canvas_y,
  280,
  150
from public.projects project
cross join (
  values
    (
      '10000000-0000-4000-8000-000000000001'::uuid,
      null::uuid,
      'platform',
      'Platform map',
      E'# Platform map\n\nThe product architecture at a glance. Follow the branches to explore runtime boundaries, APIs, and ownership.\n\n## Principles\n\n- Keep boundaries explicit.\n- Prefer boring, observable infrastructure.\n- Documentation changes with the system.',
      0, 80::double precision, 100::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'product-surface',
      'Product surface',
      E'# Product surface\n\nThe user-facing workspace combines a documentation canvas, Markdown editor, and agent operations.\n\n## Current surface\n\n- Documentation tree\n- Flexible architecture canvas\n- Preview-first editing',
      0, 440::double precision, 20::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000003'::uuid,
      '10000000-0000-4000-8000-000000000001'::uuid,
      'application-api',
      'Application API',
      E'# Application API\n\nNext.js route handlers expose a small JSON API over the documentation domain.\n\n## Contract\n\nEvery write is validated and uses optimistic concurrency through `lock_version`.',
      1, 440::double precision, 220::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000004'::uuid,
      '10000000-0000-4000-8000-000000000003'::uuid,
      'supabase',
      'Supabase',
      E'# Supabase\n\nPostgreSQL is the source of truth for Markdown, hierarchy, canvas position, revisions, and asset metadata.\n\nImage bytes live in a private Storage bucket and are served through signed redirects.',
      0, 800::double precision, 220::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000010'::uuid,
      null::uuid,
      'devops',
      'DevOps',
      E'# DevOps\n\nDelivery automation keeps the application and database schema moving together.\n\n## Shipping path\n\n1. Validate in CI.\n2. Apply idempotent migrations.\n3. Deploy the dashboard.\n4. Run production smoke checks.',
      1, 80::double precision, 500::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000011'::uuid,
      '10000000-0000-4000-8000-000000000010'::uuid,
      'continuous-delivery',
      'Continuous delivery',
      E'# Continuous delivery\n\nGitHub Actions runs unit tests and TypeScript checks before applying Supabase migrations. Vercel deploys changes from `main`.',
      0, 440::double precision, 500::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000012'::uuid,
      '10000000-0000-4000-8000-000000000010'::uuid,
      'observability',
      'Observability',
      E'# Observability\n\nStart with actionable signals:\n\n- deployment status\n- API health\n- migration completion\n- document write conflicts\n- image upload failures',
      1, 800::double precision, 500::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000020'::uuid,
      null::uuid,
      'infrastructure',
      'Infrastructure',
      E'# Infrastructure\n\nA deliberately small managed stack keeps operational load low while the product surface evolves.',
      2, 80::double precision, 800::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000021'::uuid,
      '10000000-0000-4000-8000-000000000020'::uuid,
      'runtime',
      'Runtime',
      E'# Runtime\n\n- **Vercel** hosts the Next.js application.\n- **Supabase** hosts PostgreSQL and private object storage.\n- **GitHub Actions** validates and migrates.',
      0, 440::double precision, 800::double precision
    ),
    (
      '10000000-0000-4000-8000-000000000022'::uuid,
      '10000000-0000-4000-8000-000000000020'::uuid,
      'data-lifecycle',
      'Data lifecycle',
      E'# Data lifecycle\n\nDocuments use immutable revision snapshots. Canvas-only moves do not create content revisions. Archived assets remain available to historical revisions.',
      1, 800::double precision, 800::double precision
    )
) as seed (
  id, parent_id, slug, title, markdown, sort_order, canvas_x, canvas_y
)
where project.slug = 'cursor-cto-hack'
on conflict (id) do nothing;
