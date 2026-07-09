"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
} from "@xyflow/react";
import type {
  RoadmapTask,
  RoadmapTaskDependency,
} from "@shared/types";
import { buildTaskGraphLayout } from "@/lib/roadmap-graph";
import { formatMinutes } from "@/lib/roadmap";

export function TaskDag({
  tasks,
  dependencies,
}: {
  tasks: RoadmapTask[];
  dependencies: RoadmapTaskDependency[];
}) {
  const layout = useMemo(
    () => buildTaskGraphLayout(tasks, dependencies),
    [tasks, dependencies],
  );
  const nodes = layout.nodes.map(({ task, x, y }) => ({
    id: task.id,
    position: { x, y },
    draggable: false,
    className: `dag-node ${task.status}`,
    data: {
      label: (
        <div className="dag-node-content">
          <span className="mono">{task.status.replaceAll("_", " ")}</span>
          <strong>{task.title}</strong>
          <span>{task.progress_percent}% complete</span>
          <span>{formatMinutes(task.estimate_minutes)} estimated</span>
        </div>
      ),
    },
  }));
  const edges = layout.edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
  }));

  return (
    <div className="task-dag" aria-label="Subtask dependency graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
