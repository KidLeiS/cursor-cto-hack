"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
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
  const router = useRouter();
  const layout = useMemo(
    () => buildTaskGraphLayout(tasks, dependencies),
    [tasks, dependencies],
  );
  const [taskState, setTaskState] = useState(tasks);
  const [message, setMessage] = useState(
    "Connect prerequisite → dependent. Select an edge and press Delete to remove it.",
  );
  const [saving, setSaving] = useState(false);

  const taskLabel = useCallback(
    (task: RoadmapTask) => (
      <div className="dag-node-content">
        <span className="mono">{task.status.replaceAll("_", " ")}</span>
        <strong>{task.title}</strong>
        <span>{task.progress_percent}% complete</span>
        <span>{formatMinutes(task.estimate_minutes)} estimated</span>
      </div>
    ),
    [],
  );
  const initialNodes = useMemo<Node[]>(
    () =>
      layout.nodes.map(({ task, x, y }) => ({
        id: task.id,
        position: { x, y },
        className: `dag-node ${task.status}`,
        data: { label: taskLabel(task) },
      })),
    [layout.nodes, taskLabel],
  );
  const initialEdges = useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: false,
      })),
    [layout.edges],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const persistDependencies = useCallback(
    async (taskId: string, dependencyIds: string[]) => {
      const task = taskState.find((candidate) => candidate.id === taskId);
      if (!task) return false;
      setSaving(true);
      setMessage("Saving dependency graph…");
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_task_id: task.parent_task_id,
            slug: task.slug,
            title: task.title,
            description: task.description,
            status: task.status,
            progress_percent: task.progress_percent,
            estimate_minutes: task.estimate_minutes,
            planning_prompt: task.planning_prompt,
            implementation_prompt: task.implementation_prompt,
            validation_gate: task.validation_gate,
            sort_order: task.sort_order,
            expected_lock_version: task.lock_version,
            dependency_ids: dependencyIds,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          setMessage(
            response.status === 409
              ? "This graph changed elsewhere. Reload before editing."
              : body.error || "The graph could not be saved.",
          );
          return false;
        }
        const updated = body.data as RoadmapTask;
        setTaskState((current) =>
          current.map((candidate) =>
            candidate.id === updated.id ? updated : candidate,
          ),
        );
        setNodes((current) =>
          current.map((node) =>
            node.id === updated.id
              ? {
                  ...node,
                  className: `dag-node ${updated.status}`,
                  data: { label: taskLabel(updated) },
                }
              : node,
          ),
        );
        router.refresh();
        setMessage("Dependency graph saved.");
        return true;
      } catch {
        setMessage("The graph could not be reached.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router, setNodes, taskLabel, taskState],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || saving) return;
      if (
        connection.source === connection.target ||
        edges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.target === connection.target,
        )
      ) {
        setMessage("That dependency already exists or is invalid.");
        return;
      }
      const dependencyIds = edges
        .filter((edge) => edge.target === connection.target)
        .map((edge) => edge.source)
        .concat(connection.source);
      if (await persistDependencies(connection.target, dependencyIds)) {
        setEdges((current) =>
          addEdge(
            {
              ...connection,
              id: `edge-${connection.source}-${connection.target}`,
              markerEnd: { type: MarkerType.ArrowClosed },
            },
            current,
          ),
        );
      }
    },
    [edges, persistDependencies, saving, setEdges],
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      if (saving) return;
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
      const targets = new Set(deletedEdges.map((edge) => edge.target));
      for (const target of targets) {
        const dependencyIds = edges
          .filter(
            (edge) => edge.target === target && !deletedIds.has(edge.id),
          )
          .map((edge) => edge.source);
        if (!(await persistDependencies(target, dependencyIds))) return;
      }
      setEdges((current) =>
        current.filter((edge) => !deletedIds.has(edge.id)),
      );
    },
    [edges, persistDependencies, saving, setEdges],
  );

  return (
    <div className="task-dag" aria-label="Subtask dependency graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={(connection) => void onConnect(connection)}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={(deleted) => void onEdgesDelete(deleted)}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesConnectable={!saving}
        elementsSelectable
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background gap={20} size={1} />
        <Controls />
        <Panel className="dag-editor-status" position="top-left">
          {message}
        </Panel>
      </ReactFlow>
    </div>
  );
}
