# Sushicode remote MCP

Sushicode exposes a stateless Streamable HTTP MCP server at:

```text
https://YOUR-VERCEL-DOMAIN/api/mcp
```

It gives connected agents read/write access to project documentation and roadmap
tasks. The server runs as a normal Next.js route handler, so it can be deployed
with the dashboard on Vercel; no separate process or always-on server is needed.

## Vercel setup

1. Generate a strong random secret, for example:

   ```bash
   openssl rand -hex 32
   ```

2. Open the Vercel project, then **Settings → Environment Variables**.
3. Add `MCP_API_KEY` with the generated value. Enable it for Production and any
   Preview environments that should expose MCP.
4. Confirm the existing Supabase variables are available in the same environment.
5. Redeploy the application. Environment variable changes do not affect an
   already-built deployment.

The endpoint deliberately returns `503` when `MCP_API_KEY` is missing and `401`
when the Bearer token is incorrect. Never expose this key through a
`NEXT_PUBLIC_` variable.

## Cursor setup

Open **Cursor Settings → Tools & MCP → New MCP Server**. If Cursor opens the MCP
configuration file, add:

```json
{
  "mcpServers": {
    "sushicode": {
      "url": "https://YOUR-VERCEL-DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

Use `~/.cursor/mcp.json` for your account/machine or `.cursor/mcp.json` for a
project-specific connection. Do not commit a project file containing a real key.
After saving, enable `sushicode` in Cursor's MCP settings and verify that its ten
tools appear.

Example prompts:

```text
Read the documentation tree and summarize the authentication architecture.
```

```text
Read the current roadmap, add a task for API rate limiting, and include a
validation gate. Re-read the task after writing it.
```

```text
Update the Platform document with the decisions from this conversation. Read it
first and preserve unrelated sections.
```

## Verify with curl

Initialize:

```bash
curl -sS https://YOUR-VERCEL-DOMAIN/api/mcp \
  -H "Authorization: Bearer YOUR_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

List tools:

```bash
curl -sS https://YOUR-VERCEL-DOMAIN/api/mcp \
  -H "Authorization: Bearer YOUR_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Concurrency and security

All edit/delete tools require the `lock_version` returned by a preceding read.
If another user or agent writes first, the stale write fails; the agent should
read again and retry deliberately.

This is a project-level shared secret suitable for the hackathon. Before using
the service for multiple customers, replace it with per-user OAuth or scoped API
tokens and tighten the current anonymous Supabase policies.

## Demo polling

The workspace polls `/api/workspace/sync` every two seconds while the tab is
visible and no document edit, canvas drag/resize, or roadmap write is active.
The route computes an ETag from IDs, lock versions, timestamps, and dependency
edges. Unchanged polls return `304` without sending document or roadmap bodies.
This is intentionally optimized for the demo; a longer interval or push-based
invalidation is more appropriate at larger scale.
