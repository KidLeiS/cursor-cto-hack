# Sushicode remote MCP

Sushicode exposes a stateless Streamable HTTP MCP server at:

```text
https://YOUR-VERCEL-DOMAIN/api/mcp
```

It gives connected agents read/write access to project documentation and roadmap
tasks. The server runs as a normal Next.js route handler, so it can be deployed
with the dashboard on Vercel; no separate process or always-on server is needed.

## Create a personal key

1. Sign in to Sushicode as the approved project user.
2. Select **Connect MCP**.
3. Name and create a key.
4. Copy the value immediately. Only its SHA-256 hash is stored and the plaintext
   cannot be shown again.

Keys belong to a user and project, are limited to 60 tool calls per minute, and
can be revoked immediately from the same dialog. The old shared Vercel
`MCP_API_KEY` is not accepted.

## Cursor setup

Open **Cursor Settings → Tools & MCP → New MCP Server**. If Cursor opens the MCP
configuration file, add:

```json
{
  "mcpServers": {
    "sushicode": {
      "url": "https://YOUR-VERCEL-DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_PERSONAL_MCP_KEY",
        "MCP-Protocol-Version": "2025-11-25"
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
  -H "Authorization: Bearer YOUR_PERSONAL_MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

List tools:

```bash
curl -sS https://YOUR-VERCEL-DOMAIN/api/mcp \
  -H "Authorization: Bearer YOUR_PERSONAL_MCP_KEY" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

## Concurrency and security

All edit/delete tools require the `lock_version` returned by a preceding read.
If another user or agent writes first, the stale write fails; the agent should
read again and retry deliberately.

Key metadata, use timestamps, and tool audit events are stored without recording
the plaintext key. Database RLS denies anonymous access and limits authenticated
access to approved project membership. MCP tools execute through a server-only
service client after the key, owner, project, scope, expiry, revocation, and rate
limit checks pass.

## Demo polling

The workspace polls `/api/workspace/sync` every two seconds while the tab is
visible and no document edit, canvas drag/resize, or roadmap write is active.
The route computes an ETag from IDs, lock versions, timestamps, and dependency
edges. Unchanged polls return `304` without sending document or roadmap bodies.
This is intentionally optimized for the demo; a longer interval or push-based
invalidation is more appropriate at larger scale.
