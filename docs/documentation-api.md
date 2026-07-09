# Authenticated documentation API

The documentation component exposes a same-origin JSON API for the authenticated
dashboard. Requests require a valid Supabase session for the approved project
member; anonymous and cross-origin access is rejected.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/docs/health` | Database readiness and seeded node count |
| `GET` | `/api/docs` | Project metadata and all canvas nodes |
| `POST` | `/api/docs` | Create a root or child document |
| `GET` | `/api/docs/:id` | Document, immutable revisions, and image metadata |
| `PATCH` | `/api/docs/:id` | Save content, move/reparent, or restore a revision |
| `DELETE` | `/api/docs/:id?lock_version=1` | Delete a leaf document |
| `POST` | `/api/docs/assets` | Multipart image upload (`node_id`, `file`, `alt_text`) |
| `DELETE` | `/api/docs/assets/:id` | Archive an image |
| `GET` | `/api/docs/assets/:id/content` | Redirect to a short-lived signed image URL |

All writes are validated. The project is capped at 250 documents,
500 KB of Markdown per document, 10 KB of canvas metadata, and 10 MB per image.
Image signatures are checked rather than trusting the browser MIME declaration.
Updates require the current `expected_lock_version`; stale writes return HTTP
`409`. Object IDs are scoped to the configured project before every mutation.

## Examples

Use the dashboard or an authenticated session cookie for these routes. Agents
should use the remote MCP API rather than forwarding browser cookies.

```bash
curl -X POST https://YOUR_HOST/api/docs \
  -H 'content-type: application/json' \
  -d '{
    "title": "Security",
    "slug": "security",
    "markdown": "# Security",
    "canvas_x": 440,
    "canvas_y": 980
  }'
```

```bash
curl -X PATCH https://YOUR_HOST/api/docs/NODE_ID \
  -H 'content-type: application/json' \
  -d '{
    "operation": "content",
    "expected_lock_version": 1,
    "title": "Security",
    "slug": "security",
    "markdown": "# Security\n\nUpdated."
  }'
```
