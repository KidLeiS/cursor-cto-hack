# Sushicode

Sushicode is a shared product workspace for people and coding agents. It turns
documentation, an executable roadmap, and a visual project map into durable
context that Cursor, Codex, and other MCP-capable agents can read and update.

Built for the Cursor iOS Hack with [Cursor](https://cursor.com),
[Supabase](https://supabase.com), and Vercel.

## What you can do

- Organize Markdown documentation as a draggable, resizable canvas tree.
- Edit notes with a rich Markdown editor and attach images.
- Track roadmap tasks, dependencies, prompts, validation gates, and progress.
- Turn timeline notes into documentation and roadmap work.
- Connect an agent through remote MCP so it can read and edit shared context.
- See documentation and roadmap updates in the workspace without refreshing.

## Agent workflow

The dashboard is the shared source of truth. An agent reads the relevant
documentation or roadmap task before acting, makes a version-protected update,
then re-reads the result to verify it.

```text
Person or agent → Sushicode documentation / roadmap → implementation → validation
```

The remote MCP exposes 10 tools:

```text
documentation_list · documentation_get · documentation_create
documentation_update · documentation_delete
roadmap_list · roadmap_get · roadmap_create · roadmap_update · roadmap_delete
```

Every edit and delete uses optimistic locking. If someone changed a record after
an agent read it, the stale write fails instead of silently overwriting their work.

## Connect Cursor or Cursor iOS

Sushicode uses a remote Streamable HTTP MCP endpoint:

```text
https://YOUR-VERCEL-DOMAIN/api/mcp
```

Configure the server in Cursor:

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

Cursor iOS selects MCP servers configured for Cloud Agents; add the remote
server at [cursor.com/agents](https://cursor.com/agents) first, then enable it
for the mobile run. Generate a personal key from **Connect MCP** after signing
in. Keys are shown once, stored as hashes, and can be revoked. Do not commit a
real key.

See [the remote MCP guide](docs/remote-mcp.md) for Vercel setup, Cursor setup,
curl verification, and security notes.

## Run locally

```bash
cd dashboard
pnpm install
cp .env.example .env.local
pnpm dev
```

Without Supabase credentials, the dashboard starts with demo data. To connect a
real project, set these in `dashboard/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SB_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
NEXT_PUBLIC_PROJECT_SLUG=cursor-cto-hack
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_RATE_LIMIT_SECRET=YOUR_RANDOM_SERVER_SECRET
```

## Deploy with Vercel

1. Import this repository in Vercel.
2. Set the project root directory to `dashboard`.
3. Select the Next.js framework preset.
4. Add the environment variables below for Production and Preview.
5. Deploy.

| Variable | Purpose |
| --- | --- |
| `SB_URL` | Supabase project URL |
| `SB_PK` | Supabase anon key |
| `SB_SERVICE_ROLE_KEY` | Server-only key used after application authorization |
| `NEXT_PUBLIC_PROJECT_SLUG` | Project slug; normally `cursor-cto-hack` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for magic-link callbacks |
| `AUTH_RATE_LIMIT_SECRET` | Server-only pepper for login request throttling |
| `DS_API` | Server-side DeepSeek key for the task tracker |
| `DEEPSEEK_MODEL` | Optional; defaults to `deepseek-chat` |
| `CF_ACC` | Cloudflare account ID for Workers AI transcription |
| `CF_API` | Cloudflare token for Workers AI transcription |

Never prefix `DS_API`, `CF_API`, `SB_SERVICE_ROLE_KEY`, or
`AUTH_RATE_LIMIT_SECRET` with `NEXT_PUBLIC_`. Changes to Vercel environment
variables require a redeploy.

Access is waitlist-only. Supabase Auth and database RLS currently permit only
`eric@aimalcolm.com`; all other submitted addresses become pending waitlist
entries.

## Verify

```bash
cd dashboard
pnpm test
pnpm typecheck
pnpm build
```

CI runs unit tests and type checks on pushes, applies Supabase migrations on
`main`, and runs a production smoke test after Vercel deploys.

## Project layout

```text
dashboard/              Next.js workspace and remote MCP endpoint
supabase/migrations/    PostgreSQL schema and RPCs
shared/                 Shared TypeScript data contracts
docs/                   Backend, API, and MCP guides
skills/ and prompts/    Portable agent workflows
scripts/                Migration and production smoke tooling
```

## License

TBD
