# Cursor CTO — Async Cloud Architecture Agent

**iOS Cursor Hack · Sponsored by [Cursor](https://cursor.com) & [Supabase](https://supabase.com)**

Harness-native CTO toolkit: Cursor (or Codex / Claude) runs the agents; **our intelligence** is skills + shared context + an editable workplan dashboard.

---

## Stack (Option B)

| Piece | Role |
| --- | --- |
| **Cursor / Codex / Claude** | Superior harness (tools, cloud agents, iOS) |
| **Skills + prompts** | Portable “brain” — Feature & Debug agents |
| **Supabase** | Shared mutable context agents and UI both read/write |
| **Vercel dashboard** | Visualise maps/gates; **edit workplans** before implementers run |
| **GitHub Actions** | Unit tests locally-style; migrate + Vercel deploy + prod smoke |

**Contract:** dashboard edits win. Implement prompts always re-read the step from Supabase before coding.

---

## Environment setup

GitHub Actions already has:

| Secret | What it is | Used by |
| --- | --- | --- |
| `SB_URL` | `https://<ref>.supabase.co` | migration + production smoke |
| `SB_PK` | Supabase **anon public** key | production smoke |
| `SB_PW` | Database password | migration only |

Set these Vercel project environment variables for Production and Preview:

| Variable | Value |
| --- | --- |
| `SB_URL` | same project URL |
| `SB_PK` | same anon public key |
| `NEXT_PUBLIC_PROJECT_SLUG` | `cursor-cto-hack` |

`SB_PW` is not needed by the dashboard and should stay only in GitHub Actions.

---

## CI pipeline (hackathon)

```text
PR / push  → GitHub Actions unit + typecheck (no secrets)
push main  → GitHub Actions migrate Supabase
push/PR    → Vercel's GitHub integration deploys frontend/
deploy OK  → GitHub deployment_status event → production smoke
```

Workflows: [CI](.github/workflows/ci.yml) and [production smoke](.github/workflows/production-smoke.yml).

### One-time Vercel setup (no CLI tokens)

1. Vercel dashboard → **Add New → Project**
2. Import `KidLeiS/cursor-cto-hack`
3. Set **Root Directory** to `frontend`
4. Framework preset: **Next.js**
5. Add the three Vercel variables above for Production + Preview
6. Deploy

Vercel then deploys every push itself and reports the deployment URL back to GitHub. No `VERCEL_TOKEN`, org ID, project ID, or deployment CLI is required.

---

## Local unit tests (no secrets)

```bash
cd frontend
pnpm install
pnpm test        # node:test domain helpers + demo bundle
pnpm typecheck
```

---

## Two agent kinds

### Feature agent
Intent (and optional frontend notes) → modules + validation gates + editable workplan → cheap implement/validate loops.

- Skill: [`skills/feature-agent/SKILL.md`](skills/feature-agent/SKILL.md)
- Prompts: [`prompts/feature-plan.md`](prompts/feature-plan.md), [`prompts/feature-implement.md`](prompts/feature-implement.md)

### Debug agent
Symptom / failing gate → triage + minimal fix workplan → implement/validate (no feature expansion).

- Skill: [`skills/debug-agent/SKILL.md`](skills/debug-agent/SKILL.md)
- Prompts: [`prompts/debug-plan.md`](prompts/debug-plan.md), [`prompts/debug-implement.md`](prompts/debug-implement.md)

---

## Repo layout

```text
.
├── .github/workflows/ci.yml
├── backend/
│   ├── scripts/migrate.mjs      # SB_URL + SB_PW
│   └── supabase/migrations/
├── frontend/                    # Next.js → Vercel
├── scripts/smoke.mjs            # DASHBOARD_URL + SB_URL + SB_PK
├── shared/types.ts
└── skills/  prompts/  templates/  platform/
```

---

## Manual Supabase (optional)

CI migrate applies [`backend/supabase/migrations/001_init.sql`](backend/supabase/migrations/001_init.sql). You can also paste it in the Supabase SQL editor once.

Local dashboard without secrets loads **demo** data. With `.env.local`:

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=<SB_URL>
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<SB_PK>
pnpm dev
```

---

## License

TBD
