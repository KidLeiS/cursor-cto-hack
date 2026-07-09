import type {
  Project,
  RoadmapTask,
  RoadmapTaskDependency,
} from "@shared/types";
import { getSupabase } from "./data";

export interface RoadmapBundle {
  project: Project;
  tasks: RoadmapTask[];
  dependencies: RoadmapTaskDependency[];
  source: "supabase" | "demo";
}

export interface RoadmapTaskNode extends RoadmapTask {
  children: RoadmapTaskNode[];
}

export interface RoadmapTree {
  roots: RoadmapTaskNode[];
  orphaned: RoadmapTaskNode[];
}

export interface RoadmapTaskGraph {
  root: RoadmapTask;
  tasks: RoadmapTask[];
  dependencies: RoadmapTaskDependency[];
}

const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_ROOT_ID = "10000000-0000-4000-8000-000000000001";
const DEMO_TIME = "2026-07-09T00:00:00.000Z";

const demoTaskDefaults = {
  project_id: DEMO_PROJECT_ID,
  parent_task_id: DEMO_ROOT_ID,
  description: null,
  lock_version: 1,
  created_at: DEMO_TIME,
  updated_at: DEMO_TIME,
} as const;

export function demoRoadmapBundle(): RoadmapBundle {
  const project: Project = {
    id: DEMO_PROJECT_ID,
    slug: "cursor-cto-hack",
    name: "Cursor CTO Hack",
    repo_url: "https://github.com/KidLeiS/cursor-cto-hack",
    created_at: DEMO_TIME,
    updated_at: DEMO_TIME,
  };

  const tasks: RoadmapTask[] = [
    {
      ...demoTaskDefaults,
      id: DEMO_ROOT_ID,
      parent_task_id: null,
      slug: "roadmap-foundation",
      title: "Build the roadmap foundation",
      description:
        "Deliver the first end-to-end roadmap backend and task experience.",
      status: "in_progress",
      progress_percent: 48,
      estimate_minutes: 600,
      planning_prompt:
        "Design an incremental roadmap that reuses the existing Next.js and Supabase architecture.",
      implementation_prompt:
        "Implement the roadmap schema, API, task list, and task-detail dependency graph.",
      validation_gate:
        "All roadmap unit tests, endpoint tests, type checks, and the production build pass.",
      sort_order: 0,
    },
    {
      ...demoTaskDefaults,
      id: "10000000-0000-4000-8000-000000000002",
      slug: "model-roadmap-data",
      title: "Model roadmap data",
      description: "Create the shared task model and acyclic dependency edges.",
      status: "done",
      progress_percent: 100,
      estimate_minutes: 90,
      planning_prompt:
        "Define one core model shared by tasks and subtasks, with explicit DAG edges.",
      implementation_prompt:
        "Add constrained PostgreSQL tables, optimistic locking, RLS, and seed data.",
      validation_gate:
        "Migration applies twice without errors and rejects hierarchy or dependency cycles.",
      sort_order: 0,
    },
    {
      ...demoTaskDefaults,
      id: "10000000-0000-4000-8000-000000000003",
      slug: "expose-task-api",
      title: "Expose the task API",
      description: "Provide list, detail, create, update, and delete endpoints.",
      status: "in_progress",
      progress_percent: 65,
      estimate_minutes: 180,
      planning_prompt:
        "Specify stable JSON contracts and request validation for roadmap consumers.",
      implementation_prompt:
        "Implement Next.js route handlers backed by Supabase and the demo fallback.",
      validation_gate:
        "Endpoint tests cover successful reads and invalid mutation payloads.",
      sort_order: 1,
    },
    {
      ...demoTaskDefaults,
      id: "10000000-0000-4000-8000-000000000004",
      slug: "render-task-experience",
      title: "Render the task experience",
      description:
        "Show progress, remaining estimates, prompts, gates, and dependencies.",
      status: "ready",
      progress_percent: 15,
      estimate_minutes: 240,
      planning_prompt:
        "Design an accessible task list and a readable left-to-right DAG.",
      implementation_prompt:
        "Build server-rendered task pages and a React Flow graph component.",
      validation_gate:
        "Seed tasks render at /tasks and every graph node exposes prompt and gate details.",
      sort_order: 2,
    },
    {
      ...demoTaskDefaults,
      id: "10000000-0000-4000-8000-000000000005",
      slug: "validate-roadmap",
      title: "Validate the roadmap",
      description:
        "Exercise domain rules, endpoints, types, and the production bundle.",
      status: "planned",
      progress_percent: 0,
      estimate_minutes: 90,
      planning_prompt:
        "List failure modes for malformed graphs, invalid updates, and missing tasks.",
      implementation_prompt:
        "Add focused tests and execute the complete dashboard validation suite.",
      validation_gate:
        "Tests, typecheck, and next build all complete successfully.",
      sort_order: 3,
    },
  ];

  const dependencyPairs = [
    [tasks[2].id, tasks[1].id],
    [tasks[3].id, tasks[2].id],
    [tasks[4].id, tasks[3].id],
  ];
  const dependencies: RoadmapTaskDependency[] = dependencyPairs.map(
    ([taskId, prerequisiteId], index) => ({
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      project_id: DEMO_PROJECT_ID,
      task_id: taskId,
      depends_on_task_id: prerequisiteId,
      created_at: DEMO_TIME,
    }),
  );

  return { project, tasks, dependencies, source: "demo" };
}

function compareTasks(a: RoadmapTask, b: RoadmapTask): number {
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
}

export function buildRoadmapTree(tasks: RoadmapTask[]): RoadmapTree {
  const nodes = new Map<string, RoadmapTaskNode>(
    tasks.map((task) => [task.id, { ...task, children: [] }]),
  );
  const roots: RoadmapTaskNode[] = [];
  const orphaned: RoadmapTaskNode[] = [];

  for (const node of nodes.values()) {
    if (!node.parent_task_id) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parent_task_id);
    if (parent) parent.children.push(node);
    else orphaned.push(node);
  }

  const sortRecursively = (items: RoadmapTaskNode[]) => {
    items.sort(compareTasks);
    for (const item of items) sortRecursively(item.children);
  };
  sortRecursively(roots);
  sortRecursively(orphaned);
  return { roots, orphaned };
}

export function taskGraphFor(
  bundle: RoadmapBundle,
  taskId: string,
): RoadmapTaskGraph | null {
  const root = bundle.tasks.find((task) => task.id === taskId);
  if (!root) return null;

  const includedIds = new Set<string>();
  let frontier = [root.id];
  while (frontier.length > 0) {
    const parents = new Set(frontier);
    frontier = bundle.tasks
      .filter(
        (task) =>
          task.parent_task_id !== null &&
          parents.has(task.parent_task_id) &&
          !includedIds.has(task.id),
      )
      .map((task) => task.id);
    for (const id of frontier) includedIds.add(id);
  }

  // A leaf task remains useful as a one-node graph.
  if (includedIds.size === 0) includedIds.add(root.id);

  return {
    root,
    tasks: bundle.tasks.filter((task) => includedIds.has(task.id)).sort(compareTasks),
    dependencies: bundle.dependencies.filter(
      (dependency) =>
        includedIds.has(dependency.task_id) &&
        includedIds.has(dependency.depends_on_task_id),
    ),
  };
}

export function estimatedRemainingMinutes(task: RoadmapTask): number | null {
  if (task.estimate_minutes === null) return null;
  return Math.max(
    0,
    Math.round(task.estimate_minutes * (1 - task.progress_percent / 100)),
  );
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Unestimated";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export async function loadRoadmapBundle(): Promise<RoadmapBundle> {
  const supabase = getSupabase();
  if (!supabase) return demoRoadmapBundle();

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (projectError || !project) return demoRoadmapBundle();

  const [tasks, dependencies] = await Promise.all([
    supabase
      .from("roadmap_tasks")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order"),
    supabase
      .from("roadmap_task_dependencies")
      .select("*")
      .eq("project_id", project.id),
  ]);

  if (tasks.error || dependencies.error) return demoRoadmapBundle();
  return {
    project: project as Project,
    tasks: (tasks.data ?? []) as RoadmapTask[],
    dependencies: (dependencies.data ?? []) as RoadmapTaskDependency[],
    source: "supabase",
  };
}
