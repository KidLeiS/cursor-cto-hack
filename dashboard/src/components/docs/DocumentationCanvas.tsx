"use client";

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentationNode } from "../../../../shared/types";

type DocumentationNodeData = {
  document: DocumentationNode;
  selected: boolean;
};

type FlowDocumentNode = Node<DocumentationNodeData, "document">;

const DocumentationCard = memo(function DocumentationCard({
  data,
}: NodeProps<FlowDocumentNode>) {
  const { document, selected } = data;
  const summary = document.markdown
    .replace(/[#*`_[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <article className={`doc-card${selected ? " selected" : ""}`}>
      <Handle type="target" position={Position.Left} className="doc-handle" />
      <span className="doc-card-kicker">
        {document.parent_id ? "document" : "root map"}
      </span>
      <h3>{document.title}</h3>
      <p>{summary.slice(0, 112) || "Empty document"}</p>
      <span className="doc-card-version">v{document.content_version}</span>
      <Handle type="source" position={Position.Right} className="doc-handle" />
    </article>
  );
});

const nodeTypes = { document: DocumentationCard };

function toFlowNodes(
  documents: DocumentationNode[],
  selectedId: string | null,
): FlowDocumentNode[] {
  return documents.map((document) => ({
    id: document.id,
    type: "document",
    position: { x: document.canvas_x, y: document.canvas_y },
    width: document.canvas_width ?? 280,
    height: document.canvas_height ?? 150,
    data: { document, selected: document.id === selectedId },
    selected: document.id === selectedId,
  }));
}

function Canvas({
  documents,
  selectedId,
  resetKey,
  disabled,
  onSelect,
  onMove,
}: {
  documents: DocumentationNode[];
  selectedId: string | null;
  resetKey: number;
  disabled: boolean;
  onSelect: (id: string) => void;
  onMove: (document: DocumentationNode, x: number, y: number) => void;
}) {
  const [nodes, setNodes] = useState<FlowDocumentNode[]>(() =>
    toFlowNodes(documents, selectedId),
  );

  useEffect(() => {
    setNodes(toFlowNodes(documents, selectedId));
  }, [documents, selectedId, resetKey]);

  const edges = useMemo<Edge[]>(
    () =>
      documents
        .filter((document) => document.parent_id)
        .map((document) => ({
          id: `${document.parent_id}-${document.id}`,
          source: document.parent_id!,
          target: document.id,
          type: "smoothstep",
          style: { stroke: "rgba(194, 239, 160, 0.46)", strokeWidth: 1.4 },
        })),
    [documents],
  );

  const onNodesChange = useCallback((changes: NodeChange<FlowDocumentNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_event, node) => onSelect(node.id)}
      onNodeDragStop={(_event, node) => {
        const document = documents.find((item) => item.id === node.id);
        if (document) onMove(document, node.position.x, node.position.y);
      }}
      fitView
      fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
      minZoom={0.18}
      maxZoom={1.8}
      nodesConnectable={false}
      nodesDraggable={!disabled}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: false }}
    >
      <Background color="rgba(232, 240, 234, 0.08)" gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) =>
          node.id === selectedId ? "#c4f082" : "rgba(155, 176, 163, 0.7)"
        }
        maskColor="rgba(8, 12, 10, 0.72)"
      />
    </ReactFlow>
  );
}

export function DocumentationCanvas(props: {
  documents: DocumentationNode[];
  selectedId: string | null;
  resetKey: number;
  disabled: boolean;
  onSelect: (id: string) => void;
  onMove: (document: DocumentationNode, x: number, y: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
