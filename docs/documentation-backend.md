# Documentation tree backend

The first page component is backed by PostgreSQL, Supabase Storage, and Next.js
server actions. No editor or canvas UI is included in this change.

## Data model

- `documentation_nodes` stores one Markdown document per row. `parent_id` forms
  the tree; multiple rows with no parent provide independent top-level maps such
  as Platform, DevOps, and Infrastructure.
- `canvas_x`, `canvas_y`, optional dimensions, and `canvas_metadata` store layout
  separately from Markdown. Moving a branch therefore does not create a content
  revision.
- `documentation_revisions` contains immutable snapshots. A database trigger
  records the previous content for every title, slug, or Markdown update,
  regardless of which client performs the write.
- `documentation_assets` contains image metadata. Bytes are limited to 10 MB and
  stored in the private `documentation-assets` Supabase Storage bucket.
- `documentation_storage_cleanup_queue` records physical objects that must be
  removed after hard metadata cascades, since Storage deletion cannot participate
  in a PostgreSQL transaction.

Sibling slugs are unique, parent/project foreign keys cannot cross projects, and
a trigger prevents cycles. `lock_version` provides optimistic concurrency for
both editor saves and canvas moves. `content_version` advances only when
document content changes.

Content updates, canvas moves, and node deletes go through database functions
that require the caller's expected `lock_version`. Direct table updates are
blocked by RLS. Moves take a project-scoped transaction lock, preventing two
concurrent moves from creating a cycle.

## Backend API

Read helpers are in `dashboard/src/lib/documentation.ts`:

- `loadDocumentationNodes(projectId)`
- `loadDocumentationTree(projectId)`
- `loadDocumentationRevisions(nodeId)`
- `loadDocumentationAssets(nodeId)` (includes one-hour signed image URLs)

Mutations are Next.js server actions in
`dashboard/src/lib/documentation-actions.ts`:

- create, edit, move, restore, and delete a document
- upload and delete an image

Image uploads return Markdown using an `asset:<uuid>` URL. The eventual renderer
should replace that token with the corresponding signed URL returned by
`loadDocumentationAssets`; signed URLs must not be persisted because they
expire. Deleting an image archives it instead of destroying the object, because
immutable document revisions may still reference it. Read helpers paginate
through Supabase's default row limit.

## Access control

The migration intentionally matches the repository's existing hack/demo RLS
model, where the anonymous key can mutate project data. Before adding user
accounts, replace the open node/asset and Storage policies with project
membership checks. Revision rows are read-only to clients and are written only
by the versioning trigger.
