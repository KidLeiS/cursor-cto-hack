import type {
  RoadmapTask,
  RoadmapTaskDependency,
} from "@shared/types";

export interface TaskGraphNodeLayout {
  task: RoadmapTask;
  x: number;
  y: number;
}

export interface TaskGraphEdgeLayout {
  id: string;
  source: string;
  target: string;
}

export interface TaskGraphLayout {
  nodes: TaskGraphNodeLayout[];
  edges: TaskGraphEdgeLayout[];
  cyclicTaskIds: string[];
}

/** Assigns deterministic left-to-right ranks without requiring browser layout. */
export function buildTaskGraphLayout(
  tasks: RoadmapTask[],
  dependencies: RoadmapTaskDependency[],
): TaskGraphLayout {
  const taskIds = new Set(tasks.map((task) => task.id));
  const edges = dependencies
    .filter(
      (edge) =>
        taskIds.has(edge.task_id) && taskIds.has(edge.depends_on_task_id),
    )
    .map((edge) => ({
      id: edge.id,
      source: edge.depends_on_task_id,
      target: edge.task_id,
    }));
  const indegrees = new Map(tasks.map((task) => [task.id, 0]));
  const outgoing = new Map(tasks.map((task) => [task.id, [] as string[]]));
  for (const edge of edges) {
    indegrees.set(edge.target, (indegrees.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const rank = new Map(tasks.map((task) => [task.id, 0]));
  const queue = tasks
    .filter((task) => indegrees.get(task.id) === 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((task) => task.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    visited.add(id);
    for (const dependentId of outgoing.get(id) ?? []) {
      rank.set(
        dependentId,
        Math.max(rank.get(dependentId) ?? 0, (rank.get(id) ?? 0) + 1),
      );
      const nextIndegree = (indegrees.get(dependentId) ?? 1) - 1;
      indegrees.set(dependentId, nextIndegree);
      if (nextIndegree === 0) queue.push(dependentId);
    }
  }

  const cyclicTaskIds = tasks
    .filter((task) => !visited.has(task.id))
    .map((task) => task.id);
  const rowsByRank = new Map<number, number>();
  const nodes = tasks
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((task) => {
      const taskRank = rank.get(task.id) ?? 0;
      const row = rowsByRank.get(taskRank) ?? 0;
      rowsByRank.set(taskRank, row + 1);
      return { task, x: taskRank * 340, y: row * 210 };
    });

  return { nodes, edges, cyclicTaskIds };
}
