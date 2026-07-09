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

Configure `ds_api` in Vercel. `DEEPSEEK_MODEL` is optional and defaults to
`deepseek-chat`. The key is never sent to the browser.

## Speech input

The microphone beside the Timeline text input records at most 60 seconds in the
browser. `POST /api/task-tracker/transcribe` accepts the recording as multipart
form data, limits it to 4 MB, and sends base64 audio to Cloudflare Workers AI.
The transcript is appended to the same text field; the user can review or edit
it before sending it to DeepSeek.

Speech recognition uses `@cf/openai/whisper-large-v3-turbo`. Cloudflare lists it
as its best-accuracy multilingual transcription model, and it has the same
per-minute price as the older Whisper model. Configure `CF_ACC` and `CF_API` in
Vercel. A custom token needs Workers AI Read and Workers AI Edit permissions.

## Persistence

Migration `005_task_tracker.sql` creates `task_tracker_items`, priority and
status enums, calendar indexes, optimistic versioning, and the
`update_task_tracker_action` checkpoint RPC. Migration
`006_task_tracker_mutations.sql` adds manual completion and optimistic RPCs for
editing, drag-rescheduling, completing, and deleting calendar items.

The calendar record stores:

- client title, description, priority, scheduled date, deadline, and effort;
- the Markdown documentation update;
- the roadmap description, planning prompt, implementation prompt, and
  validation gate;
- links to the documentation and roadmap records created by Action.

## Action pipeline

`POST /api/task-tracker/:id/action` requires `expected_lock_version`.

1. Claim the item with an optimistic-lock checkpoint.
2. Give DeepSeek project-scoped tools to list documentation, retrieve relevant
   documents, and edit a bounded task section (or create a document when none
   fits).
3. Persist the documentation link.
4. Create a `ready` roadmap task with a stable slug.
5. Persist the roadmap link and mark the calendar item actioned.

The model never receives database credentials or an unrestricted write tool.
Every tool input is validated, every document is rechecked against the task's
project, a document must be retrieved before it can be edited, reads and writes
are size-limited, and each run is bounded to six turns and eight calls. Document
content and task text are treated as untrusted data.

The edited section uses stable HTML comment markers and the roadmap uses
`task-<tracker UUID>` as its slug. Retries therefore update/reuse prior work
instead of duplicating it. A failed stage stores its error and can be retried.
The successful response includes every changed document, the roadmap item, and
an agent summary so the spatial canvas can refresh immediately and show exactly
what changed.

This is application-level orchestration rather than one database transaction
because documentation revisions and existing roadmap RPCs have separate write
contracts. Durable checkpoints make partial completion visible and recoverable.

## HTTP endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/task-tracker` | List calendar items for the configured project |
| `POST` | `/api/task-tracker` | Parse and persist one or more tasks |
| `POST` | `/api/task-tracker/transcribe` | Convert a short recording into editable text |
| `PATCH` | `/api/task-tracker/:id` | Edit, reschedule, or manually complete a task |
| `DELETE` | `/api/task-tracker/:id` | Delete a task with optimistic locking |
| `POST` | `/api/task-tracker/:id/action` | Update docs, then create roadmap work |
