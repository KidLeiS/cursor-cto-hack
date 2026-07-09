# Task tracker backend

## Boundary

The task tracker is a client-facing calendar, not an implementation roadmap.
Items have a scheduled date, optional deadline, and product priority. They only
enter `roadmap_tasks` after a product manager chooses **Action task**.

## Natural-language parsing

`POST /api/task-tracker` accepts:

```json
{
  "input": "Prepare the launch brief by Friday and confirm owners tomorrow",
  "time_zone": "America/Los_Angeles"
}
```

The server calls DeepSeek's chat-completions endpoint with JSON output enabled.
The prompt includes the complete output JSON Schema, and the response is
independently validated with Zod before any database write. Invalid or partial
model output fails closed.

Configure `DEEPSEEK_API_KEY` in Vercel. `DEEPSEEK_MODEL` is optional and defaults
to `deepseek-chat`. The key is never sent to the browser.

## Persistence

Migration `005_task_tracker.sql` creates `task_tracker_items`, priority and
status enums, calendar indexes, optimistic versioning, and the
`update_task_tracker_action` checkpoint RPC.

The calendar record stores:

- client title, description, priority, scheduled date, deadline, and effort;
- the Markdown documentation update;
- the roadmap description, planning prompt, implementation prompt, and
  validation gate;
- links to the documentation and roadmap records created by Action.

## Action pipeline

`POST /api/task-tracker/:id/action` requires `expected_lock_version`.

1. Claim the item with an optimistic-lock checkpoint.
2. Create or update the shared `task-updates` document.
3. Persist the documentation link.
4. Create a `ready` roadmap task with a stable slug.
5. Persist the roadmap link and mark the calendar item actioned.

The documentation section uses stable HTML comment markers and the roadmap uses
`task-<tracker UUID>` as its slug. Retries therefore update/reuse prior work
instead of duplicating it. A failed stage stores its error and can be retried.

This is application-level orchestration rather than one database transaction
because documentation revisions and existing roadmap RPCs have separate write
contracts. Durable checkpoints make partial completion visible and recoverable.

## HTTP endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/task-tracker` | List calendar items for the configured project |
| `POST` | `/api/task-tracker` | Parse and persist one or more tasks |
| `POST` | `/api/task-tracker/:id/action` | Update docs, then create roadmap work |
