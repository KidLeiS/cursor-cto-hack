"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import {
  createDocumentationNode,
  deleteDocumentationNode,
  moveDocumentationNode,
  uploadDocumentationImage,
} from "@/lib/documentation-actions";
import { updateWorkplanStep } from "@/lib/actions";
import type { DashboardBundle } from "@/lib/data";
import type {
  DocumentationNode,
  Feature,
  WorkplanStep,
} from "../../../shared/types";

type WorkspaceProps = {
  bundle: DashboardBundle;
  documentationNodes: DocumentationNode[];
};

type Point = { x: number; y: number };
type Granularity = "hours" | "days" | "weeks";
type TimelineItem = {
  id: string;
  title: string;
  note: string;
  priority: number;
  kind: "note" | "agent" | "task";
  status: string;
};

const NODE_WIDTH = 256;
const NODE_HEIGHT = 138;

function Icon({
  name,
  size = 16,
}: {
  name:
    | "arrow-left"
    | "check"
    | "chevron"
    | "close"
    | "file"
    | "folder"
    | "grid"
    | "hide-left"
    | "hide-right"
    | "more"
    | "move"
    | "note"
    | "plus"
    | "search"
    | "sparkle"
    | "trash"
    | "upload"
    | "zoom-in"
    | "zoom-out";
  size?: number;
}) {
  const paths: Record<typeof name, ReactNode> = {
    "arrow-left": <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: (
      <>
        <path d="m7 7 10 10" />
        <path d="M17 7 7 17" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5" />
        <path d="M9 13h6M9 17h5" />
      </>
    ),
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </>
    ),
    "hide-left": (
      <>
        <rect x="3" y="4" width="18" height="16" />
        <path d="M9 4v16m8-12-4 4 4 4" />
      </>
    ),
    "hide-right": (
      <>
        <rect x="3" y="4" width="18" height="16" />
        <path d="M15 4v16M7 8l4 4-4 4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    move: (
      <>
        <path d="M12 2v20M2 12h20" />
        <path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />
      </>
    ),
    note: (
      <>
        <path d="M5 3h14v18H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.2 4.3L17 9l-3.8 1.7L12 15l-1.2-4.3L7 9l3.8-1.7z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
      </>
    ),
    trash: (
      <>
        <path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-4 4 4-4 4 4" />
        <path d="M4 14v7h16v-7" />
      </>
    ),
    "zoom-in": (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M7.5 10.5h6M10.5 7.5v6" />
      </>
    ),
    "zoom-out": (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5M7.5 10.5h6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </g>
    </svg>
  );
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

function demoDocumentation(projectId: string): DocumentationNode[] {
  const now = new Date().toISOString();
  const make = (
    id: string,
    parentId: string | null,
    title: string,
    markdown: string,
    x: number,
    y: number,
    order: number,
  ): DocumentationNode => ({
    id: `demo-${id}`,
    project_id: projectId,
    parent_id: parentId ? `demo-${parentId}` : null,
    slug: slugify(title),
    title,
    markdown,
    sort_order: order,
    canvas_x: x,
    canvas_y: y,
    canvas_width: NODE_WIDTH,
    canvas_height: NODE_HEIGHT,
    canvas_metadata: {},
    content_version: 1,
    lock_version: 1,
    created_at: now,
    updated_at: now,
  });

  return [
    make("product", null, "Product", "Vision, users, and product principles.", 180, 130, 0),
    make("platform", null, "Platform", "The system map for Sushicode.", 180, 480, 1),
    make("vision", "product", "Product vision", "A live spatial model of how software gets built.", 520, 70, 0),
    make("journeys", "product", "User journeys", "Designer plans. Agents understand. Swarms execute.", 520, 250, 1),
    make("workspace", "platform", "Workspace", "Human control surface and information architecture.", 520, 430, 0),
    make("agents", "platform", "Agent system", "Frontier planners coordinate lower-cost executors.", 520, 610, 1),
    make("canvas", "workspace", "IA canvas", "Infinite nested notes connected as a living tree.", 860, 340, 0),
    make("timeline", "workspace", "Timeline", "Freeform, semantic planning across time scales.", 860, 520, 1),
    make("features", "workspace", "Feature progress", "Quantitative execution state for agents.", 860, 700, 2),
    make("planner", "agents", "Frontier planner", "Translates between code intent and user intent.", 860, 880, 0),
    make("swarm", "agents", "Execution swarm", "Focused implementation agents working from approved plans.", 860, 1060, 1),
  ];
}

function initialPositions(nodes: DocumentationNode[]): Record<string, Point> {
  const result: Record<string, Point> = {};
  const children = new Map<string | null, DocumentationNode[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parent_id) ?? [];
    siblings.push(node);
    children.set(node.parent_id, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.sort_order - b.sort_order);
  }

  let row = 0;
  const place = (node: DocumentationNode, depth: number) => {
    const hasStoredPosition = node.canvas_x !== 0 || node.canvas_y !== 0;
    result[node.id] = hasStoredPosition
      ? { x: node.canvas_x, y: node.canvas_y }
      : { x: 180 + depth * 340, y: 120 + row++ * 176 };
    for (const child of children.get(node.id) ?? []) place(child, depth + 1);
  };
  for (const root of children.get(null) ?? []) place(root, 0);
  return result;
}

function buildTimeline(bundle: DashboardBundle): TimelineItem[] {
  const runItems = bundle.agentRuns.map((run, index) => ({
    id: `run-${run.id}`,
    title: run.title,
    note: run.intent,
    priority: run.status === "failed" ? 5 : run.status === "implementing" ? 4 : 3,
    kind: "agent" as const,
    status: run.status,
    sort: index * 2,
  }));
  const stepItems = bundle.steps.map((step, index) => ({
    id: `step-${step.id}`,
    title: step.title,
    note: step.implementation_plan,
    priority: step.status === "blocked" ? 5 : step.status === "ready" ? 4 : 2,
    kind: "task" as const,
    status: step.status,
    sort: index * 2 + 1,
  }));
  const items: TimelineItem[] = [...runItems, ...stepItems]
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 7)
    .map(({ sort: _sort, ...item }) => item);

  if (items.length < 4) {
    items.push(
      {
        id: "note-review",
        title: "Review product IA",
        note: "Validate that the current information architecture matches how the team talks about the product.",
        priority: 5,
        kind: "note",
        status: "focus",
      },
      {
        id: "note-sync",
        title: "Sync with engineering",
        note: "Resolve open backend contracts and confirm agent handoff boundaries.",
        priority: 3,
        kind: "note",
        status: "planned",
      },
    );
  }
  return items;
}

function timelineLabel(granularity: Granularity, index: number) {
  if (granularity === "hours") return `${String(9 + index).padStart(2, "0")}:00`;
  if (granularity === "days") return ["Mon 09", "Tue 10", "Wed 11", "Thu 12", "Fri 13"][index % 5];
  return `W${28 + index}`;
}

function featureProgress(feature: Feature, bundle: DashboardBundle, steps: WorkplanStep[]) {
  const gates = bundle.gates.filter((gate) => gate.feature_id === feature.id);
  const plans = new Set(
    bundle.workplans.filter((plan) => plan.feature_id === feature.id).map((plan) => plan.id),
  );
  const featureSteps = steps.filter((step) => plans.has(step.workplan_id));
  const total = gates.length + featureSteps.length;
  const complete =
    gates.filter((gate) => gate.status === "pass").length +
    featureSteps.filter((step) => step.status === "done").length;
  if (total) return Math.round((complete / total) * 100);
  return feature.status === "done" ? 100 : feature.status === "validating" ? 80 : 28;
}

export function SushicodeWorkspace({ bundle, documentationNodes }: WorkspaceProps) {
  const initialNodes = useMemo(
    () =>
      documentationNodes.length
        ? documentationNodes
        : demoDocumentation(bundle.project.id),
    [bundle.project.id, documentationNodes],
  );
  const backendEnabled = bundle.source === "supabase";
  const [nodes, setNodes] = useState(initialNodes);
  const [positions, setPositions] = useState(() => initialPositions(initialNodes));
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const root = initialNodes.find((node) => node.parent_id === null);
    return new Set(root ? [root.id] : []);
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNodes.find((node) => node.parent_id === null)?.id ?? null,
  );
  const [movingId, setMovingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.86);
  const [pan, setPan] = useState({ x: 300, y: 42 });
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);
  const [toast, setToast] = useState("Live workspace ready");
  const [drag, setDrag] = useState<{
    id: string;
    pointerX: number;
    pointerY: number;
    origin: Point;
  } | null>(null);
  const [panDrag, setPanDrag] = useState<{
    pointerX: number;
    pointerY: number;
    origin: Point;
  } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const [granularity, setGranularity] = useState<Granularity>("hours");
  const [priorityMode, setPriorityMode] = useState(false);
  const [timeline, setTimeline] = useState(() => buildTimeline(bundle));
  const [openTimelineId, setOpenTimelineId] = useState<string | null>(null);

  const [features, setFeatures] = useState(bundle.features);
  const [steps, setSteps] = useState(bundle.steps);
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(true);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, DocumentationNode[]>();
    for (const node of nodes) {
      const list = map.get(node.parent_id) ?? [];
      list.push(node);
      map.set(node.parent_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [nodes]);

  const visibleIds = useMemo(() => {
    const result = new Set<string>();
    const walk = (node: DocumentationNode) => {
      result.add(node.id);
      if (expanded.has(node.id)) {
        for (const child of childrenByParent.get(node.id) ?? []) walk(child);
      }
    };
    for (const root of childrenByParent.get(null) ?? []) walk(root);
    return result;
  }, [childrenByParent, expanded]);

  const visibleNodes = nodes.filter((node) => visibleIds.has(node.id));
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;
  const orderedTimeline = [...timeline].sort((a, b) =>
    priorityMode ? b.priority - a.priority : timeline.indexOf(a) - timeline.indexOf(b),
  );
  const activeFeature = features.find((feature) => feature.id === activeFeatureId) ?? null;

  async function persistNodeMove(node: DocumentationNode, point: Point, parentId = node.parent_id) {
    if (!backendEnabled || node.id.startsWith("demo-")) return;
    const result = await moveDocumentationNode({
      id: node.id,
      expected_lock_version: node.lock_version,
      parent_id: parentId,
      sort_order: node.sort_order,
      canvas_x: point.x,
      canvas_y: point.y,
      canvas_width: node.canvas_width,
      canvas_height: node.canvas_height,
      canvas_metadata: node.canvas_metadata,
    });
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    if (result.data) {
      setNodes((current) =>
        current.map((item) => (item.id === result.data!.id ? result.data! : item)),
      );
    }
    setToast("Canvas position synced");
  }

  function selectNode(node: DocumentationNode) {
    if (movingId && movingId !== node.id) {
      const moving = nodes.find((item) => item.id === movingId);
      if (moving) {
        setNodes((current) =>
          current.map((item) =>
            item.id === moving.id ? { ...item, parent_id: node.id } : item,
          ),
        );
        setExpanded((current) => new Set(current).add(node.id));
        void persistNodeMove(moving, positions[moving.id], node.id);
        setToast(`Moved “${moving.title}” into “${node.title}”`);
      }
      setMovingId(null);
      return;
    }
    setSelectedId(node.id);
    if ((childrenByParent.get(node.id) ?? []).length) {
      setExpanded((current) => new Set(current).add(node.id));
    }
  }

  function toggleNode(nodeId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function handleNodePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    node: DocumentationNode,
  ) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: positions[node.id],
    });
  }

  function handleNodePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = {
      x: Math.round(drag.origin.x + (event.clientX - drag.pointerX) / zoom),
      y: Math.round(drag.origin.y + (event.clientY - drag.pointerY) / zoom),
    };
    setPositions((current) => ({ ...current, [drag.id]: next }));
  }

  function handleNodePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const next = {
      x: Math.round(drag.origin.x + (event.clientX - drag.pointerX) / zoom),
      y: Math.round(drag.origin.y + (event.clientY - drag.pointerY) / zoom),
    };
    const node = nodes.find((item) => item.id === drag.id);
    setPositions((current) => ({ ...current, [drag.id]: next }));
    setDrag(null);
    if (node) void persistNodeMove(node, next);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".ia-node")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanDrag({
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: pan,
    });
  }

  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panDrag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setPan({
      x: panDrag.origin.x + event.clientX - panDrag.pointerX,
      y: panDrag.origin.y + event.clientY - panDrag.pointerY,
    });
  }

  function handleCanvasPointerUp() {
    setPanDrag(null);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(1.35, Math.max(0.52, current - event.deltaY * 0.001)));
  }

  async function addChild() {
    const title = window.prompt("Name this note or folder");
    if (!title?.trim()) return;
    const parent = selectedNode;
    const siblings = childrenByParent.get(parent?.id ?? null) ?? [];
    const point = parent
      ? {
          x: positions[parent.id].x + 340,
          y: positions[parent.id].y + siblings.length * 164,
        }
      : { x: 180, y: 120 + nodes.length * 40 };
    const draft: DocumentationNode = {
      id: `demo-new-${Date.now()}`,
      project_id: bundle.project.id,
      parent_id: parent?.id ?? null,
      slug: slugify(title),
      title: title.trim(),
      markdown: "New note — add context here.",
      sort_order: siblings.length,
      canvas_x: point.x,
      canvas_y: point.y,
      canvas_width: NODE_WIDTH,
      canvas_height: NODE_HEIGHT,
      canvas_metadata: {},
      content_version: 1,
      lock_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (backendEnabled && (!parent || !parent.id.startsWith("demo-"))) {
      const result = await createDocumentationNode({
        project_id: draft.project_id,
        parent_id: draft.parent_id,
        slug: draft.slug,
        title: draft.title,
        markdown: draft.markdown,
        sort_order: draft.sort_order,
        canvas_x: point.x,
        canvas_y: point.y,
        canvas_width: NODE_WIDTH,
        canvas_height: NODE_HEIGHT,
      });
      if (!result.ok) {
        setToast(result.error);
        return;
      }
      if (result.data) draft.id = result.data.id;
    }
    setNodes((current) => [...current, draft]);
    setPositions((current) => ({ ...current, [draft.id]: point }));
    if (parent) setExpanded((current) => new Set(current).add(parent.id));
    setSelectedId(draft.id);
    setToast("New note added");
  }

  async function deleteSelected() {
    if (!selectedNode) return;
    if ((childrenByParent.get(selectedNode.id) ?? []).length) {
      setToast("Move or delete nested notes before deleting this folder");
      return;
    }
    if (!window.confirm(`Delete “${selectedNode.title}”?`)) return;
    if (backendEnabled && !selectedNode.id.startsWith("demo-")) {
      const result = await deleteDocumentationNode({
        id: selectedNode.id,
        expected_lock_version: selectedNode.lock_version,
      });
      if (!result.ok) {
        setToast(result.error);
        return;
      }
    }
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setSelectedId(selectedNode.parent_id);
    setToast("Note deleted");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedNode) return;
    if (!backendEnabled || selectedNode.id.startsWith("demo-")) {
      setToast(`${file.name} attached to ${selectedNode.title}`);
      event.target.value = "";
      return;
    }
    const data = new FormData();
    data.set("project_id", bundle.project.id);
    data.set("node_id", selectedNode.id);
    data.set("file", file);
    const result = await uploadDocumentationImage(data);
    setToast(result.ok ? `${file.name} uploaded` : result.error);
    event.target.value = "";
  }

  function addTimelineItem() {
    const title = window.prompt(`Add a note to this ${granularity.slice(0, -1)}`);
    if (!title?.trim()) return;
    const item: TimelineItem = {
      id: `local-${Date.now()}`,
      title: title.trim(),
      note: "Click to add more detail and context.",
      priority: 3,
      kind: "note",
      status: "draft",
    };
    setTimeline((current) => [...current, item]);
    setOpenTimelineId(item.id);
  }

  function createFeature() {
    const title = window.prompt("Feature name");
    if (!title?.trim()) return;
    const now = new Date().toISOString();
    setFeatures((current) => [
      ...current,
      {
        id: `local-feature-${Date.now()}`,
        project_id: bundle.project.id,
        slug: slugify(title),
        title: title.trim(),
        summary: "Human-created feature awaiting implementation detail.",
        status: "planned",
        frontend_notes: null,
        backend_notes: null,
        module_ids: [],
        created_at: now,
        updated_at: now,
      },
    ]);
    setToast("Feature added to the plan");
  }

  async function toggleStep(step: WorkplanStep) {
    const status = step.status === "done" ? "ready" : "done";
    setSteps((current) =>
      current.map((item) => (item.id === step.id ? { ...item, status } : item)),
    );
    if (bundle.source === "supabase") {
      const result = await updateWorkplanStep({ ...step, status });
      if (!result.ok) setToast(result.error);
    }
  }

  const openTimeline = timeline.find((item) => item.id === openTimelineId) ?? null;
  const activePlans = new Set(
    bundle.workplans
      .filter((plan) => plan.feature_id === activeFeatureId)
      .map((plan) => plan.id),
  );
  const activeSteps = steps.filter((step) => activePlans.has(step.workplan_id));

  return (
    <main className="workspace-shell">
      <span className="sr-only">sushicode is code</span>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <strong>Sushicode</strong>
          <span className="workspace-divider">/</span>
          <button className="project-switcher" type="button">
            Product workspace <Icon name="chevron" size={13} />
          </button>
        </div>
        <div className="topbar-center">
          <span className="live-dot" />
          IA synced now
        </div>
        <div className="topbar-actions">
          <button
            aria-label={hideLeft ? "Show timeline" : "Hide timeline"}
            className={hideLeft ? "icon-button active" : "icon-button"}
            onClick={() => setHideLeft((value) => !value)}
            type="button"
          >
            <Icon name="hide-left" />
          </button>
          <button
            aria-label={hideRight ? "Show features" : "Hide features"}
            className={hideRight ? "icon-button active" : "icon-button"}
            onClick={() => setHideRight((value) => !value)}
            type="button"
          >
            <Icon name="hide-right" />
          </button>
          <div className="avatar">KL</div>
        </div>
      </header>

      <div
        className={panDrag ? "canvas-viewport is-panning" : "canvas-viewport"}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onWheel={handleWheel}
      >
        <div className="canvas-label">
          <Icon name="grid" />
          <span>Information architecture</span>
          <span className="canvas-count">{nodes.length} notes</span>
        </div>

        <div
          className="canvas-surface"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg className="connections" height="1400" width="2200">
            {visibleNodes.map((node) => {
              if (!node.parent_id || !visibleIds.has(node.parent_id)) return null;
              const parent = positions[node.parent_id];
              const child = positions[node.id];
              if (!parent || !child) return null;
              const startX = parent.x + NODE_WIDTH;
              const startY = parent.y + NODE_HEIGHT / 2;
              const endX = child.x;
              const endY = child.y + NODE_HEIGHT / 2;
              const bend = Math.max(72, (endX - startX) * 0.5);
              return (
                <path
                  className={selectedId === node.id ? "connection selected" : "connection"}
                  d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`}
                  key={`${node.parent_id}-${node.id}`}
                />
              );
            })}
          </svg>

          {visibleNodes.map((node) => {
            const childCount = (childrenByParent.get(node.id) ?? []).length;
            const isOpen = expanded.has(node.id);
            const isSelected = node.id === selectedId;
            return (
              <div
                className={[
                  "ia-node",
                  childCount ? "folder-node" : "document-node",
                  isSelected ? "selected" : "",
                  drag?.id === node.id ? "dragging" : "",
                  movingId === node.id ? "moving" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={node.id}
                onClick={() => selectNode(node)}
                onPointerDown={(event) => handleNodePointerDown(event, node)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={handleNodePointerUp}
                style={{ left: positions[node.id]?.x ?? 0, top: positions[node.id]?.y ?? 0 }}
              >
                {childCount ? <div className="folder-tab" /> : null}
                <div className="node-header">
                  <span className="node-icon">
                    <Icon name={childCount ? "folder" : "file"} size={15} />
                  </span>
                  <span>{childCount ? "Folder" : "Note"}</span>
                  <button
                    aria-label="More options"
                    className="node-more"
                    onClick={(event) => event.stopPropagation()}
                    type="button"
                  >
                    <Icon name="more" />
                  </button>
                </div>
                <h3>{node.title}</h3>
                <p>{node.markdown || "No detail added yet."}</p>
                <div className="node-footer">
                  <span>v{node.content_version}</span>
                  {childCount ? (
                    <button
                      className="node-open"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleNode(node.id);
                      }}
                      type="button"
                    >
                      {childCount} {childCount === 1 ? "item" : "items"}
                      <span className={isOpen ? "chevron open" : "chevron"}>
                        <Icon name="chevron" size={13} />
                      </span>
                    </button>
                  ) : (
                    <span>README.md</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="canvas-controls">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.52, value - 0.1))}
            type="button"
          >
            <Icon name="zoom-out" />
          </button>
          <button className="zoom-value" onClick={() => setZoom(0.86)} type="button">
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}
            type="button"
          >
            <Icon name="zoom-in" />
          </button>
          <span />
          <button
            aria-label="Reset view"
            onClick={() => {
              setPan({ x: 300, y: 42 });
              setZoom(0.86);
            }}
            type="button"
          >
            <Icon name="grid" />
          </button>
        </div>
      </div>

      {!hideLeft ? (
        <aside className="floating-panel timeline-panel">
          {openTimeline ? (
            <div className="panel-detail">
              <button
                className="back-button"
                onClick={() => setOpenTimelineId(null)}
                type="button"
              >
                <Icon name="arrow-left" /> Timeline
              </button>
              <div className="detail-kicker">
                {timelineLabel(granularity, timeline.indexOf(openTimeline))}
                <span className={`kind-dot ${openTimeline.kind}`} />
              </div>
              <h2>{openTimeline.title}</h2>
              <label className="note-label">
                Note
                <textarea
                  onChange={(event) =>
                    setTimeline((current) =>
                      current.map((item) =>
                        item.id === openTimeline.id
                          ? { ...item, note: event.target.value }
                          : item,
                      ),
                    )
                  }
                  value={openTimeline.note}
                />
              </label>
              <div className="context-card">
                <Icon name="sparkle" />
                <div>
                  <strong>Context understood</strong>
                  <p>Linked to the current project plan and visible agent activity.</p>
                </div>
              </div>
              <div className="detail-meta">
                <span>Priority</span>
                <div className="priority-bars">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      aria-label={`Set priority ${level}`}
                      className={level <= openTimeline.priority ? "filled" : ""}
                      key={level}
                      onClick={() =>
                        setTimeline((current) =>
                          current.map((item) =>
                            item.id === openTimeline.id
                              ? { ...item, priority: level }
                              : item,
                          ),
                        )
                      }
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Human plan</span>
                  <h2>Timeline</h2>
                </div>
                <button className="add-button" onClick={addTimelineItem} type="button">
                  <Icon name="plus" /> Add
                </button>
              </div>
              <div className="priority-toggle-row">
                <div>
                  <Icon name="sparkle" />
                  <span>Show by priority</span>
                </div>
                <button
                  aria-pressed={priorityMode}
                  className={priorityMode ? "switch on" : "switch"}
                  onClick={() => setPriorityMode((value) => !value)}
                  type="button"
                >
                  <span />
                </button>
              </div>
              <div className="timeline-scroll">
                <div className="timeline-date">
                  <strong>{granularity === "hours" ? "Today" : granularity === "days" ? "This week" : "Q3"}</strong>
                  <span>July 9, 2026</span>
                </div>
                {orderedTimeline.map((item, index) => (
                  <div className="timeline-slot" key={item.id}>
                    <span className="time-label">
                      {priorityMode ? `P${6 - item.priority}` : timelineLabel(granularity, index)}
                    </span>
                    <span className="timeline-rule" />
                    <button
                      className={`timeline-card ${item.kind}`}
                      onClick={() => setOpenTimelineId(item.id)}
                      type="button"
                    >
                      <span className={`kind-dot ${item.kind}`} />
                      <span className="timeline-copy">
                        <strong>{item.title}</strong>
                        <span>{item.note}</span>
                      </span>
                      <Icon name="note" />
                    </button>
                  </div>
                ))}
                <button className="empty-slot" onClick={addTimelineItem} type="button">
                  <span>{timelineLabel(granularity, orderedTimeline.length)}</span>
                  <span className="timeline-rule" />
                  <span className="empty-note">
                    <Icon name="plus" /> Add a note
                  </span>
                </button>
              </div>
              <div className="time-tabs">
                {(["hours", "days", "weeks"] as Granularity[]).map((value) => (
                  <button
                    className={granularity === value ? "active" : ""}
                    key={value}
                    onClick={() => setGranularity(value)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      ) : null}

      {!hideRight ? (
        <aside className="floating-panel feature-panel">
          {activeFeature ? (
            <div className="feature-detail">
              <button
                className="back-button"
                onClick={() => setActiveFeatureId(null)}
                type="button"
              >
                <Icon name="arrow-left" /> All features
              </button>
              <div className="detail-feature-heading">
                <span className={`status-icon ${activeFeature.status}`}>
                  <Icon name="sparkle" />
                </span>
                <div>
                  <span className="eyebrow">{activeFeature.status.replace("_", " ")}</span>
                  <h2>{activeFeature.title}</h2>
                </div>
              </div>
              <p className="feature-summary">{activeFeature.summary}</p>
              <div className="detail-progress">
                <div>
                  <span>Overall progress</span>
                  <strong>{featureProgress(activeFeature, bundle, steps)}%</strong>
                </div>
                <div className="progress-track large">
                  <span
                    style={{ width: `${featureProgress(activeFeature, bundle, steps)}%` }}
                  />
                </div>
              </div>
              <div className="subtask-heading">
                <strong>Execution plan</strong>
                <span>{activeSteps.filter((step) => step.status === "done").length}/{activeSteps.length}</span>
              </div>
              <div className="subtask-list">
                {activeSteps.length ? (
                  activeSteps.map((step) => (
                    <button
                      className={step.status === "done" ? "subtask done" : "subtask"}
                      key={step.id}
                      onClick={() => void toggleStep(step)}
                      type="button"
                    >
                      <span className="task-check">
                        {step.status === "done" ? <Icon name="check" size={13} /> : null}
                      </span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.status.replace("_", " ")}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">The planning agent has not created subtasks yet.</div>
                )}
              </div>
              <div className="agent-footer">
                <div className="agent-stack">
                  <span>AI</span>
                  <span>SW</span>
                </div>
                <span>2 agents assigned</span>
                <button type="button">
                  <Icon name="more" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Agent plan</span>
                  <h2>Features</h2>
                </div>
                <button className="icon-button subtle" onClick={createFeature} type="button">
                  <Icon name="plus" />
                </button>
              </div>
              <div className="feature-overview">
                <span>{features.length} active features</span>
                <button type="button">
                  <Icon name="search" />
                </button>
              </div>
              <div className="feature-scroll">
                {showSuggestion ? (
                  <div className="suggestion-card">
                    <div className="suggestion-heading">
                      <span><Icon name="sparkle" /> AI suggestion</span>
                      <small>Review</small>
                    </div>
                    <strong>Canvas collaboration presence</strong>
                    <p>Show who or which agent is actively changing each branch.</p>
                    <div className="suggestion-actions">
                      <button onClick={() => setShowSuggestion(false)} type="button">
                        Dismiss
                      </button>
                      <button
                        className="approve"
                        onClick={() => {
                          const now = new Date().toISOString();
                          setFeatures((current) => [
                            ...current,
                            {
                              id: `approved-${Date.now()}`,
                              project_id: bundle.project.id,
                              slug: "canvas-collaboration-presence",
                              title: "Canvas collaboration presence",
                              summary: "See humans and agents working in the architecture in real time.",
                              status: "planned",
                              frontend_notes: null,
                              backend_notes: null,
                              module_ids: [],
                              created_at: now,
                              updated_at: now,
                            },
                          ]);
                          setShowSuggestion(false);
                          setToast("AI feature approved");
                        }}
                        type="button"
                      >
                        <Icon name="check" /> Approve
                      </button>
                    </div>
                  </div>
                ) : null}
                {features.map((feature) => {
                  const progress = featureProgress(feature, bundle, steps);
                  return (
                    <button
                      className="feature-card"
                      key={feature.id}
                      onClick={() => setActiveFeatureId(feature.id)}
                      type="button"
                    >
                      <div className="feature-card-top">
                        <span className={`status-icon ${feature.status}`}>
                          {feature.status === "done" ? (
                            <Icon name="check" size={13} />
                          ) : (
                            <Icon name="sparkle" size={13} />
                          )}
                        </span>
                        <span className="feature-status">{feature.status.replace("_", " ")}</span>
                        <Icon name="chevron" size={14} />
                      </div>
                      <strong>{feature.title}</strong>
                      <span className="feature-description">{feature.summary}</span>
                      <div className="feature-progress">
                        <div className="progress-track">
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <b>{progress}%</b>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button className="new-feature" onClick={createFeature} type="button">
                <Icon name="plus" /> Create feature
              </button>
            </>
          )}
        </aside>
      ) : null}

      {selectedNode ? (
        <div className="selection-toolbar">
          <div className="selection-title">
            <span className="node-icon">
              <Icon
                name={(childrenByParent.get(selectedNode.id) ?? []).length ? "folder" : "file"}
              />
            </span>
            <span>
              <small>Selected</small>
              <strong>{selectedNode.title}</strong>
            </span>
          </div>
          <span className="toolbar-divider" />
          <button onClick={() => void addChild()} type="button">
            <Icon name="plus" /> New note
          </button>
          <button onClick={() => uploadRef.current?.click()} type="button">
            <Icon name="upload" /> Upload
          </button>
          <button
            className={movingId === selectedNode.id ? "active" : ""}
            onClick={() =>
              setMovingId((current) => (current === selectedNode.id ? null : selectedNode.id))
            }
            type="button"
          >
            <Icon name="move" /> {movingId === selectedNode.id ? "Choose folder…" : "Move"}
          </button>
          <button className="danger" onClick={() => void deleteSelected()} type="button">
            <Icon name="trash" />
          </button>
          <input
            accept="image/gif,image/jpeg,image/png,image/webp"
            hidden
            onChange={handleUpload}
            ref={uploadRef}
            type="file"
          />
        </div>
      ) : null}

      <div className="sync-toast">
        <span className="live-dot" />
        {toast}
      </div>
    </main>
  );
}
