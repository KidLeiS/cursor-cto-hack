# {{MODULE_NAME}}

> Standard module README — keep this structure so Feature/Debug agents can navigate consistently.

## Purpose

One paragraph: what this module owns and why it exists.

## Public API

- List the stable entry points (functions, routes, events, tables) other modules may use.
- Anything not listed is private and may change without notice.

## Invariants

- Rules that must always hold (auth, tenancy, idempotency, data shape, etc.).

## Dependencies

- **Upstream:** modules / services this depends on
- **Downstream:** who depends on this

## Data & storage

- Tables, buckets, queues, caches — and ownership boundaries.

## How to test

- Unit: …
- Integration: … (secrets via CI only)
- Smoke: … (if user-facing)

## Related maps

- Platform map: `platform/PLATFORM_MAP.md`
- Module map: `modules/{{MODULE_SLUG}}/MAP.md`
- Features touching this module: …

## Change log (short)

- YYYY-MM-DD — …
