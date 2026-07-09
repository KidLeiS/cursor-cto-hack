import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoadmapTree,
  demoRoadmapBundle,
  estimatedRemainingMinutes,
  taskGraphFor,
} from "../src/lib/roadmap";
import { buildTaskGraphLayout } from "../src/lib/roadmap-graph";

describe("roadmap domain", () => {
  it("uses the same task model for roots and subtasks", () => {
    const bundle = demoRoadmapBundle();
    const tree = buildRoadmapTree(bundle.tasks);

    assert.equal(tree.roots.length, 1);
    assert.equal(tree.roots[0].children.length, 4);
    assert.equal(tree.roots[0].children[0].parent_task_id, tree.roots[0].id);
    assert.equal(tree.roots[0].children[0].planning_prompt.length > 0, true);
    assert.equal(tree.orphaned.length, 0);
  });

  it("builds a subtask-only graph and keeps dependency direction", () => {
    const bundle = demoRoadmapBundle();
    const graph = taskGraphFor(bundle, bundle.tasks[0].id)!;
    const layout = buildTaskGraphLayout(graph.tasks, graph.dependencies);

    assert.equal(graph.tasks.length, 4);
    assert.equal(graph.dependencies.length, 3);
    assert.equal(layout.cyclicTaskIds.length, 0);
    assert.equal(layout.edges[0].source, graph.tasks[0].id);
    assert.equal(layout.edges[0].target, graph.tasks[1].id);
    assert.ok(layout.nodes[1].x > layout.nodes[0].x);
  });

  it("returns leaf tasks as one-node graphs", () => {
    const bundle = demoRoadmapBundle();
    const graph = taskGraphFor(bundle, bundle.tasks[1].id)!;

    assert.deepEqual(graph.tasks.map((task) => task.id), [bundle.tasks[1].id]);
    assert.deepEqual(graph.dependencies, []);
  });

  it("derives the remaining estimate from progress", () => {
    const task = demoRoadmapBundle().tasks[2];
    assert.equal(estimatedRemainingMinutes(task), 63);
  });

  it("surfaces cycles defensively even though the database rejects them", () => {
    const bundle = demoRoadmapBundle();
    const tasks = bundle.tasks.slice(1);
    const dependencies = [
      ...bundle.dependencies,
      {
        ...bundle.dependencies[0],
        id: "cycle",
        task_id: tasks[0].id,
        depends_on_task_id: tasks[3].id,
      },
    ];

    const layout = buildTaskGraphLayout(tasks, dependencies);
    assert.deepEqual(new Set(layout.cyclicTaskIds), new Set(tasks.map((task) => task.id)));
  });
});
