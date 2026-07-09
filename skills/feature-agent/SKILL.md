# Feature agent

Turn a product/feature intent (and optional frontend notes) into backend architecture work: modules touched, validation gates, and an editable workplan stored in Supabase.

## When to use

- New feature or capability
- Frontend already exists / is being built manually; backend needs designing
- User asks to “ship X” or “add Y end-to-end”

## Not for

- Bugfixes, failing tests, regressions → use **Debug agent**

## Inputs

1. `project_slug` (default `cursor-cto-hack`)
2. Feature intent (title + summary)
3. Optional: `frontend_notes`, existing module map paths, constraints
4. Supabase project URL + anon key (env) for shared context

## Procedure

### 1. Load shared context

Read from Supabase (or git mirrors if offline):

- `projects` / `modules` for the project
- Existing `features` that overlap
- Platform + module maps under `platform/` and `modules/`

### 2. Decompose (CTO / high-capability model)

Produce:

1. **Feature record** — slug, title, summary, backend notes, module_ids
2. **High-level gates** — what “done” means (then sub-gates if needed)
3. **Workplan** — ordered steps; each step has:
   - `implementation_plan`
   - `validation_requirements`
   - `target_module_ids`

Prefer extending existing modules over inventing new ones. If a new module is required, draft a standard module README (see `templates/MODULE_README.md`).

### 3. Persist

Write to Supabase in one logical transaction:

1. Upsert `features` (`status = planned`)
2. Insert `gates`
3. Insert `agent_runs` (`kind = feature`, `status = planning` → `queued` for implement)
4. Insert `workplans` + `workplan_steps` (`editable = true`)

Shape must match `FeaturePlanOutput` in `shared/types.ts`.

### 4. Hand off

- Surface the workplan URL on the Vercel dashboard for human edit
- Emit implementer prompts per step (see `prompts/feature-implement.md`) using a cheaper model
- After edits, re-read workplan from Supabase before implementing — **dashboard edits win**

### 5. Validate

For each step, run validation_requirements (unit / integration / smoke as specified). Update `gates.status` and step `status`. Escalate architectural failures back to Feature planning — do not silently widen scope.

## Output checklist

- [ ] Feature row + gates in Supabase
- [ ] Workplan steps editable on dashboard
- [ ] Module maps / READMEs updated if boundaries changed
- [ ] Implement prompts ready (one per step)
