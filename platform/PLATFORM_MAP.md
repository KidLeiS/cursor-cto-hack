# Platform map

High-level system shape for agents and humans. Update when boundaries move.

## System

| Area | Responsibility | Notes |
| --- | --- | --- |
| Frontend dashboard (Vercel) | Visualise features/modules; edit workplans | Next.js app in `frontend/` |
| Backend data layer (Supabase) | Features, gates, agent runs, workplans | `backend/supabase/migrations/` |
| Harness | Cursor / Codex / Claude agent runs | Skills + prompts; not our runtime |
| Target product | App being built by Feature/Debug agents | External or same monorepo later |

## Agent kinds

| Kind | Job |
| --- | --- |
| **Feature** | Intent → modules + gates + workplan → implement/validate |
| **Debug** | Symptom → triage + fix workplan → implement/validate |

## Module index

| Module | Path | Purpose |
| --- | --- | --- |
| _(none yet)_ | | |

## External deps

- Supabase — shared mutable context
- Vercel — dashboard hosting
- GitHub Actions — CI secrets, tests, Playwright smoke (later)
