# Documentation test API

The documentation component exposes an open JSON API for hackathon testing.
Responses include permissive CORS headers and disable caching.

> These endpoints intentionally follow the repository's anonymous demo access
> model. Add authentication and project membership policies before storing
> private documentation.

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

All writes are validated. Updates require the current `expected_lock_version`;
stale writes return HTTP `409`.

## Examples

```bash
curl https://YOUR_HOST/api/docs/health
curl https://YOUR_HOST/api/docs
```

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
