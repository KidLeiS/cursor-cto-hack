# Roadmap backend

## Model decision

Tasks and subtasks use the same `roadmap_tasks` model. A task with
`parent_task_id = null` is a roadmap item; a task with a parent is a subtask.
This adjacency-list design keeps prompts, validation, estimates, progress, and
concurrency behavior identical at every depth.

Containment is not dependency order. `roadmap_task_dependencies` stores directed
edges separately: `task_id` depends on `depends_on_task_id`. The first seed is a
linear chain, while the schema and UI support a DAG without changing the task
model. PostgreSQL triggers reject cycles in both containment and dependency
edges and composite foreign keys prevent cross-project links.

## Task fields

- `status` and `progress_percent` (0–100) drive state and progress bars.
- `estimate_minutes` is an effort estimate. Remaining effort is derived as
  `estimate * (1 - progress / 100)`; it is deliberately not a calendar promise.
- `planning_prompt`, `implementation_prompt`, and `validation_gate` are required
  non-empty executable contracts.
- `lock_version` enables compare-and-swap updates.
- `parent_task_id`, `sort_order`, and dependency edges define presentation and
  execution order.

## Database writes

Migration `003_roadmap_tasks.sql` creates three RPCs:

- `create_roadmap_task(...)` atomically creates a task and dependency edges.
- `update_roadmap_task(...)` atomically replaces task fields and dependency
  edges when `expected_lock_version` matches.
- `delete_roadmap_task(task_id, expected_lock_version)` deletes only when the
  version matches; descendants cascade.

Anonymous clients can read tables but all mutations go through these RPCs.
Authentication and project-membership RLS remain future production work,
consistent with the current hackathon backend.

## HTTP endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | Top-level task list with remaining estimates |
| `POST` | `/api/tasks` | Validated task + dependency creation |
| `GET` | `/api/tasks/:id` | Root contract, descendant graph, dependencies |
| `PATCH` | `/api/tasks/:id` | Full compare-and-swap update |
| `DELETE` | `/api/tasks/:id` | Versioned recursive delete |

Mutation payloads are validated with Zod. The dashboard uses an equivalent
in-memory seed when Supabase is not configured, which keeps local pages and read
endpoint tests deterministic.

## UI and package choices

- Next.js server components load the list and detail data.
- `@xyflow/react` renders the accessible, pannable dependency graph. It is used
  instead of maintaining custom SVG interaction code.
- A small deterministic topological layout helper keeps graph logic testable
  without a browser or a second graph-layout dependency.
- `/tasks` shows task progress and remaining effort.
- `/tasks/:id` shows the subtask DAG and the exact prompts and validation gate
  for every graph node.
