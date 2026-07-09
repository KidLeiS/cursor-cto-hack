# Debug agent

Triage a bug, failing gate, or regression: locate likely modules, produce a fix workplan, and validate without expanding into unrelated feature work.

## When to use

- Bug, regression, flaky test, failed smoke/screenshot review
- Failing validation gate on an existing feature
- “Something broke after merge”

## Not for

- Greenfield features or new capabilities → use **Feature agent**

## Inputs

1. `project_slug`
2. Symptom + repro (or link to failing CI / gate ids)
3. Optional: suspected modules, recent PRs, logs, screenshots
4. Supabase context

## Procedure

### 1. Load shared context

- Related `features`, `gates` (especially `status = fail`)
- `modules` + module READMEs for suspected areas
- Prior `debug_cases` / workplans if this is a repeat

### 2. Triage (CTO / high-capability model)

Produce:

1. **Debug case** — symptom, repro, suspected_modules, failing_gate_ids
2. **Root-cause hypothesis** (stated as hypothesis until validated)
3. **Workplan** — minimal fix steps; each with implementation_plan + validation_requirements

Rules:

- Prefer smallest fix that restores gates
- Do not redesign architecture unless the bug proves the boundary is wrong (then note it and optionally spawn a Feature agent follow-up)
- Always include a regression validation step

### 3. Persist

1. Insert `agent_runs` (`kind = debug`)
2. Insert `debug_cases`
3. Insert `workplans` + `workplan_steps` (`editable = true`)

Shape must match `DebugPlanOutput` in `shared/types.ts`.

### 4. Hand off

- Dashboard for human edit of the fix plan
- Cheaper model implements against the **current** workplan in Supabase
- Update failing gates to `pass` / leave `fail` with evidence

### 5. Validate

Re-run the failing gates and a narrow regression set. Attach evidence (test output, screenshot paths) on gates.

## Output checklist

- [ ] Debug case + workplan in Supabase
- [ ] Suspected modules linked
- [ ] Fix + regression validation steps present
- [ ] No drive-by feature scope
