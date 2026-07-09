# Cursor CTO — Async Cloud Architecture Agent

**iOS Cursor Hack · Sponsored by [Cursor](https://cursor.com) & [Supabase](https://supabase.com)**

A toolkit of Cursor skills, tools, and workflows that turn Cursor into an async cloud CTO and chief backend architect — so you can ship at lightspeed while a high-capability agent owns architecture, planning, and validation gates.

---

## The idea

Most agent coding is still synchronous and local: you sit in the loop, the model implements, you review. This project flips that.

Cursor runs **async in the cloud** as your CTO / chief architecture (backend). You set direction; it organises the system, plans the work, decomposes features into validation gates, and drives cheaper models through implement → validate cycles until the gates pass.

The goal is not “more autocomplete.” It’s a **repeatable operating system for shipping**: architecture maps, feature maps, test infrastructure, and cost-aware agent routing.

---

## Four pillars

### 1. Organisation & visualisation of architecture

Keep the codebase legible to both humans and agents.

- **Platform map** — top-level system shape: services, boundaries, data stores, external deps
- **Module maps** — per-module structure, ownership, interfaces, and dependencies
- **Standard module README** — one consistent, maximally useful template per module (purpose, public API, invariants, how to test, related maps)

Agents navigate and update these maps as the system evolves. Humans get a living architecture surface instead of tribal knowledge.

### 2. Feature map & high-level validation gates

Features are first-class artefacts, not just tickets.

- Maintain an **ongoing feature map** (what exists, what’s in flight, what’s next)
- Define **high-level validation gates** per feature (what “done” means before merge/ship)
- The AI CTO decomposes each feature into **sub-features** and **sub-validation gates** so implementation work is scoped and checkable

Gates are the contract between planning and execution.

### 3. Tools to test the app

Validation is only as strong as the harness.

| Layer | Approach |
| --- | --- |
| **Unit tests** | Fast, local, deterministic coverage of modules and pure logic |
| **Integration tests** | Cross-boundary behaviour; **secure credentials** granted via GitHub Actions / CI secrets — never baked into the repo |
| **Smoke tests** | Playwright-based flows with **screenshots**; an agent reviews screenshots for regressions and UX breaks |

CI is the trust boundary for secrets and the place where smoke evidence (screenshots + agent review) is produced.

### 4. Workplan & cost-aware agent routing

Planning is expensive; grinding through implement/validate loops should not be.

1. **Costly / high-capability agent** — produces the high-level workplan, per-step implementation plan, and validation requirements
2. **Cheaper model** — runs implementation and validation cycles against those requirements
3. Escalate back to the CTO agent when gates fail in ways that need architectural judgment

This keeps quality at the top of the funnel and cost under control in the loop.

---

## How the loop works

```text
You (intent / constraints)
        │
        ▼
┌───────────────────────┐
│  CTO agent (cloud)    │  architecture maps · feature map · workplan
│  high-capability      │  validation gates · implementation plans
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Implementer (cheap)  │  code changes against the plan
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Validators           │  unit · integration (CI secrets) · Playwright smoke
│                       │  + agent screenshot review
└───────────┬───────────┘
            │
     gates pass? ──no──► escalate / replan (CTO) or fix (implementer)
            │
           yes
            ▼
         ship
```

---

## Repo shape (target)

```text
.
├── README.md                 # this file
├── platform/                 # platform map + cross-cutting architecture
├── modules/                  # module maps + standard module READMEs
├── features/                 # feature map, gates, sub-feature breakdowns
├── workplans/                # CTO workplans & per-step implementation plans
├── skills/                   # Cursor skills for CTO / implementer / validator roles
├── tools/                    # helpers for maps, gates, smoke review, CI wiring
└── .github/workflows/        # unit, integration (secrets), Playwright smoke
```

Exact layout will firm up as skills and tools land; the maps and gates are the source of truth.

---

## Sponsors

Built for the **iOS Cursor Hack**, with thanks to:

- **Cursor** — agent runtime, skills, and cloud async workflows
- **Supabase** — backend platform for the systems this CTO stack is meant to ship against

---

## Status

Early scaffold. Next up: standard module README template, platform/module map conventions, feature-gate schema, and the first Cursor skills for CTO planning vs cheap implement/validate loops.

---

## License

TBD
