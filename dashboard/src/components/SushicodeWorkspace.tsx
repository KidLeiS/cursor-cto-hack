"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/docs/MarkdownEditor";
import {
  createDocumentationNode,
  deleteDocumentationNode,
  moveDocumentationNode,
  updateDocumentationContent,
  uploadDocumentationImage,
} from "@/lib/documentation-actions";
import {
  persistDocumentationAssetUrls,
  resolveDocumentationAssetUrls,
} from "@/lib/documentation-markdown";
import type { DashboardBundle } from "@/lib/data";
import {
  buildRoadmapTree,
  estimatedRemainingMinutes,
  formatMinutes,
  type RoadmapBundle,
  type RoadmapTaskNode,
} from "@/lib/roadmap";
import { formatTaskTrackerDate } from "@/lib/task-tracker-calendar";
import type {
  DocumentationAsset,
  DocumentationNode,
  RoadmapTask,
  TaskTrackerItem,
  TaskTrackerPriority,
} from "../../../shared/types";

type WorkspaceProps = {
  bundle: DashboardBundle;
  documentationNodes: DocumentationNode[];
  roadmapBundle: RoadmapBundle;
  taskTrackerItems: TaskTrackerItem[];
};

type Point = { x: number; y: number };
type NodeSize = { width: number; height: number };
type WorkspaceAsset = DocumentationAsset & { signed_url: string };
type Granularity = "hours" | "days" | "weeks";
type TimelineItem = {
  id: string;
  title: string;
  note: string;
  priority: number;
  kind: "note" | "agent" | "task";
  status: string;
  scheduledFor: string;
};

const NODE_WIDTH = 256;
const NODE_HEIGHT = 138;
const TRACKER_PRIORITY: Record<TaskTrackerPriority, number> = {
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
};

type TrackerApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; data?: TaskTrackerItem };

type RoadmapApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

async function trackerRequest<T>(
  url: string,
  init: RequestInit,
): Promise<TrackerApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      return {
        ok: false,
        error: body.error || `Request failed (${response.status}).`,
        data: body.data,
      };
    }
    return body;
  } catch {
    return { ok: false, error: "The task tracker could not be reached." };
  }
}

async function roadmapRequest<T>(
  url: string,
  init: RequestInit,
): Promise<RoadmapApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const body = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: body.error || `Roadmap request failed (${response.status}).`,
        status: response.status,
      };
    }
    return { ok: true, data: body.data as T };
  } catch {
    return { ok: false, error: "The roadmap could not be reached.", status: 0 };
  }
}

function localIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fullCalendarDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

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

function nodeSize(node: DocumentationNode): NodeSize {
  return {
    width: node.canvas_width ?? NODE_WIDTH,
    height: node.canvas_height ?? NODE_HEIGHT,
  };
}

function trackerTimelineItem(item: TaskTrackerItem): TimelineItem {
  return {
    id: `tracker-${item.id}`,
    title: item.title,
    note: item.description,
    priority: TRACKER_PRIORITY[item.priority],
    kind: item.status === "actioned" ? "task" : "note",
    status: item.status,
    scheduledFor: item.scheduled_for,
  };
}

function buildTimeline(items: TaskTrackerItem[]): TimelineItem[] {
  return [...items]
    .sort(
      (a, b) =>
        a.scheduled_for.localeCompare(b.scheduled_for) ||
        TRACKER_PRIORITY[b.priority] - TRACKER_PRIORITY[a.priority],
    )
    .map(trackerTimelineItem);
}

function findRoadmapNode(
  nodes: RoadmapTaskNode[],
  taskId: string,
): RoadmapTaskNode | null {
  for (const node of nodes) {
    if (node.id === taskId) return node;
    const descendant = findRoadmapNode(node.children, taskId);
    if (descendant) return descendant;
  }
  return null;
}

function timelineLabel(granularity: Granularity, index: number) {
  if (granularity === "hours") return `${String(9 + index).padStart(2, "0")}:00`;
  if (granularity === "days") return ["Mon 09", "Tue 10", "Wed 11", "Thu 12", "Fri 13"][index % 5];
  return `W${28 + index}`;
}

function trackerTimelineLabel(
  item: TimelineItem,
  granularity: Granularity,
  index: number,
  today: string,
) {
  if (granularity === "hours" && item.scheduledFor === today) {
    return timelineLabel(granularity, index);
  }
  if (granularity === "weeks") {
    const date = new Date(`${item.scheduledFor}T12:00:00`);
    const start = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((date.valueOf() - start.valueOf()) / 86400000 + start.getDay() + 1) / 7,
    );
    return `W${week}`;
  }
  return formatTaskTrackerDate(item.scheduledFor, today);
}

export function SushicodeWorkspace({
  bundle,
  documentationNodes,
  roadmapBundle,
  taskTrackerItems,
}: WorkspaceProps) {
  const router = useRouter();
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
  const [resize, setResize] = useState<{
    id: string;
    pointerX: number;
    pointerY: number;
    origin: NodeSize;
  } | null>(null);
  const [panDrag, setPanDrag] = useState<{
    pointerX: number;
    pointerY: number;
    origin: Point;
  } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorSlug, setEditorSlug] = useState("");
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [editorAssets, setEditorAssets] = useState<WorkspaceAsset[]>([]);
  const [editorBusy, setEditorBusy] = useState(false);

  const [granularity, setGranularity] = useState<Granularity>("hours");
  const [priorityMode, setPriorityMode] = useState(false);
  const [trackerItems, setTrackerItems] = useState(taskTrackerItems);
  const [timeline, setTimeline] = useState(() => buildTimeline(taskTrackerItems));
  const [openTimelineId, setOpenTimelineId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [parsingTasks, setParsingTasks] = useState(false);
  const [actioningTaskId, setActioningTaskId] = useState<string | null>(null);

  const [roadmapTasks, setRoadmapTasks] = useState(roadmapBundle.tasks);
  const [roadmapDependencies] = useState(roadmapBundle.dependencies);
  const [activeRoadmapTaskId, setActiveRoadmapTaskId] = useState<string | null>(
    null,
  );
  const [updatingRoadmapTaskId, setUpdatingRoadmapTaskId] = useState<
    string | null
  >(null);

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
  const editorNode = nodes.find((node) => node.id === editorNodeId) ?? null;
  const today = localIsoDate();
  const orderedTimeline = [...timeline].sort((a, b) =>
    priorityMode ? b.priority - a.priority : timeline.indexOf(a) - timeline.indexOf(b),
  );
  const roadmapTree = useMemo(
    () => buildRoadmapTree(roadmapTasks),
    [roadmapTasks],
  );
  const activeRoadmapTask =
    roadmapTasks.find((task) => task.id === activeRoadmapTaskId) ?? null;
  const activeRoadmapNode = activeRoadmapTaskId
    ? findRoadmapNode(roadmapTree.roots, activeRoadmapTaskId)
    : null;

  useEffect(() => {
    if (!editorNode) {
      setEditorAssets([]);
      return;
    }
    setEditorTitle(editorNode.title);
    setEditorSlug(editorNode.slug);
    setEditorMarkdown(resolveDocumentationAssetUrls(editorNode.markdown));

    if (!backendEnabled || editorNode.id.startsWith("demo-")) {
      setEditorAssets([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/docs/${editorNode.id}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok && !controller.signal.aborted) {
          setEditorAssets(
            (result.assets as WorkspaceAsset[]).filter((asset) => !asset.archived_at),
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setToast("Could not load document images");
      });
    return () => controller.abort();
  }, [backendEnabled, editorNode?.id, editorNode?.content_version]);

  async function persistNodeMove(
    node: DocumentationNode,
    point: Point,
    parentId = node.parent_id,
    size = nodeSize(node),
  ): Promise<boolean> {
    if (!backendEnabled || node.id.startsWith("demo-")) return true;
    const result = await moveDocumentationNode({
      id: node.id,
      expected_lock_version: node.lock_version,
      parent_id: parentId,
      sort_order: node.sort_order,
      canvas_x: point.x,
      canvas_y: point.y,
      canvas_width: size.width,
      canvas_height: size.height,
      canvas_metadata: node.canvas_metadata,
    });
    if (!result.ok) {
      setToast(result.error);
      return false;
    }
    if (result.data) {
      setNodes((current) =>
        current.map((item) => (item.id === result.data!.id ? result.data! : item)),
      );
    }
    setToast("Canvas position synced");
    return true;
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
        void persistNodeMove(moving, positions[moving.id], node.id).then((saved) => {
          if (!saved) {
            setNodes((current) =>
              current.map((item) =>
                item.id === moving.id ? { ...item, parent_id: moving.parent_id } : item,
              ),
            );
            return;
          }
          setToast(`Moved “${moving.title}” into “${node.title}”`);
        });
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
    if ((event.target as HTMLElement).closest("button, .node-resize-handle")) return;
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
    if (node) {
      void persistNodeMove(node, next).then((saved) => {
        if (!saved) {
          setPositions((current) => ({ ...current, [node.id]: drag.origin }));
        }
      });
    }
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

  function handleResizePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: DocumentationNode,
  ) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResize({
      id: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: nodeSize(node),
    });
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!resize || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const size = {
      width: Math.max(220, Math.round(resize.origin.width + (event.clientX - resize.pointerX) / zoom)),
      height: Math.max(120, Math.round(resize.origin.height + (event.clientY - resize.pointerY) / zoom)),
    };
    setNodes((current) =>
      current.map((node) =>
        node.id === resize.id
          ? { ...node, canvas_width: size.width, canvas_height: size.height }
          : node,
      ),
    );
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!resize) return;
    const original = resize.origin;
    const node = nodes.find((item) => item.id === resize.id);
    const size = {
      width: Math.max(220, Math.round(original.width + (event.clientX - resize.pointerX) / zoom)),
      height: Math.max(120, Math.round(original.height + (event.clientY - resize.pointerY) / zoom)),
    };
    setResize(null);
    if (!node) return;
    const updated = { ...node, canvas_width: size.width, canvas_height: size.height };
    setNodes((current) =>
      current.map((item) => (item.id === node.id ? updated : item)),
    );
    void persistNodeMove(updated, positions[node.id], node.parent_id, size).then((saved) => {
      if (!saved) {
        setNodes((current) =>
          current.map((item) =>
            item.id === node.id
              ? {
                  ...item,
                  canvas_width: original.width,
                  canvas_height: original.height,
                }
              : item,
          ),
        );
      } else {
        setToast("Node size synced");
      }
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
      if (result.data) {
        setNodes((current) => [...current, result.data!]);
        setPositions((current) => ({ ...current, [result.data!.id]: point }));
        if (parent) setExpanded((current) => new Set(current).add(parent.id));
        setSelectedId(result.data.id);
        setToast("New note added");
        return;
      }
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
    if (!result.ok || !result.data) {
      setToast(result.ok ? "Image upload did not return an asset." : result.error);
      event.target.value = "";
      return;
    }

    const updated = await updateDocumentationContent({
      id: selectedNode.id,
      expected_lock_version: selectedNode.lock_version,
      slug: selectedNode.slug,
      title: selectedNode.title,
      markdown: `${selectedNode.markdown.trimEnd()}\n\n${result.data.markdown}`,
    });
    if (!updated.ok || !updated.data) {
      setToast(updated.ok ? "Image uploaded but could not be attached to the note." : updated.error);
      event.target.value = "";
      return;
    }
    setNodes((current) =>
      current.map((node) => (node.id === updated.data!.id ? updated.data! : node)),
    );
    setToast(`${file.name} uploaded and attached to ${selectedNode.title}`);
    event.target.value = "";
  }

  async function saveEditor() {
    if (!editorNode) return;
    if (!editorTitle.trim() || !editorSlug.trim()) {
      setToast("Title and slug are required");
      return;
    }
    if (!backendEnabled || editorNode.id.startsWith("demo-")) {
      setNodes((current) =>
        current.map((node) =>
          node.id === editorNode.id
            ? {
                ...node,
                title: editorTitle.trim(),
                slug: slugify(editorSlug),
                markdown: persistDocumentationAssetUrls(editorMarkdown),
              }
            : node,
        ),
      );
      setEditorNodeId(null);
      setToast("Demo note updated locally");
      return;
    }

    setEditorBusy(true);
    const result = await updateDocumentationContent({
      id: editorNode.id,
      expected_lock_version: editorNode.lock_version,
      title: editorTitle.trim(),
      slug: slugify(editorSlug),
      markdown: persistDocumentationAssetUrls(editorMarkdown),
    });
    setEditorBusy(false);
    if (!result.ok || !result.data) {
      setToast(result.ok ? "Document save returned no data" : result.error);
      return;
    }
    setNodes((current) =>
      current.map((node) => (node.id === result.data!.id ? result.data! : node)),
    );
    setEditorNodeId(null);
    setToast("Document saved");
  }

  async function archiveEditorAsset(asset: WorkspaceAsset) {
    if (!window.confirm(`Archive “${asset.original_filename}”?`)) return;
    const response = await fetch(`/api/docs/assets/${asset.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      setToast(result.error || "Could not archive image");
      return;
    }
    setEditorAssets((current) => current.filter((item) => item.id !== asset.id));
    setToast("Image archived");
  }

  async function addTimelineItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = taskInput.trim();
    if (input.length < 3) {
      setToast("Describe the task before adding it");
      taskInputRef.current?.focus();
      return;
    }

    setParsingTasks(true);
    setToast("DeepSeek is structuring the task plan…");
    const result = await trackerRequest<TaskTrackerItem[]>("/api/task-tracker", {
      method: "POST",
      body: JSON.stringify({
        input,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    });
    setParsingTasks(false);
    if (!result.ok) {
      setToast(result.error);
      return;
    }

    const nextItems = [...trackerItems, ...result.data];
    setTrackerItems(nextItems);
    setTimeline(buildTimeline(nextItems));
    setOpenTimelineId(result.data[0] ? `tracker-${result.data[0].id}` : null);
    setTaskInput("");
    setToast(
      `${result.data.length} ${result.data.length === 1 ? "task" : "tasks"} added to the timeline`,
    );
  }

  async function actionTrackerItem(item: TaskTrackerItem) {
    setActioningTaskId(item.id);
    setToast("Updating documentation…");
    const result = await trackerRequest<{
      item: TaskTrackerItem;
      roadmap: RoadmapTask;
    }>(
      `/api/task-tracker/${item.id}/action`,
      {
        method: "POST",
        body: JSON.stringify({ expected_lock_version: item.lock_version }),
      },
    );
    setActioningTaskId(null);

    const updated = result.ok ? result.data.item : result.data;
    if (updated) {
      setTrackerItems((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setTimeline((current) =>
        current.map((candidate) =>
          candidate.id === `tracker-${updated.id}`
            ? trackerTimelineItem(updated)
            : candidate,
        ),
      );
    }
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    setRoadmapTasks((current) => {
      const roadmap = result.data.roadmap;
      return current.some((task) => task.id === roadmap.id)
        ? current.map((task) => (task.id === roadmap.id ? roadmap : task))
        : [...current, roadmap];
    });
    setActiveRoadmapTaskId(result.data.roadmap.id);
    router.refresh();
    setToast("Documentation updated · roadmap task ready");
  }

  async function updateRoadmapTask(
    task: RoadmapTask,
    changes: Partial<
      Pick<
        RoadmapTask,
        | "title"
        | "description"
        | "status"
        | "progress_percent"
        | "estimate_minutes"
        | "planning_prompt"
        | "implementation_prompt"
        | "validation_gate"
      >
    >,
  ) {
    setUpdatingRoadmapTaskId(task.id);
    const result = await roadmapRequest<RoadmapTask>(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        parent_task_id: task.parent_task_id,
        slug: task.slug,
        title: changes.title ?? task.title,
        description:
          changes.description === undefined ? task.description : changes.description,
        status: changes.status ?? task.status,
        progress_percent: changes.progress_percent ?? task.progress_percent,
        estimate_minutes:
          changes.estimate_minutes === undefined
            ? task.estimate_minutes
            : changes.estimate_minutes,
        planning_prompt: changes.planning_prompt ?? task.planning_prompt,
        implementation_prompt:
          changes.implementation_prompt ?? task.implementation_prompt,
        validation_gate: changes.validation_gate ?? task.validation_gate,
        sort_order: task.sort_order,
        expected_lock_version: task.lock_version,
        dependency_ids: roadmapDependencies
          .filter((dependency) => dependency.task_id === task.id)
          .map((dependency) => dependency.depends_on_task_id),
      }),
    });
    setUpdatingRoadmapTaskId(null);
    if (!result.ok) {
      setToast(
        result.status === 409
          ? "This roadmap task changed elsewhere. Refresh and review the latest version."
          : result.error,
      );
      return;
    }
    setRoadmapTasks((current) =>
      current.map((candidate) =>
        candidate.id === result.data.id ? result.data : candidate,
      ),
    );
    router.refresh();
    setToast(
      result.data.status === "done"
        ? "Roadmap task completed"
        : "Roadmap task updated",
    );
  }

  async function createRoadmapTaskLocally() {
    const title = window.prompt("Task title");
    if (!title?.trim()) return;
    const description = window.prompt("Short description (optional)", "")?.trim() || null;
    const result = await roadmapRequest<RoadmapTask>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        parent_task_id: null,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        title: title.trim(),
        description,
        status: "planned",
        progress_percent: 0,
        estimate_minutes: null,
        planning_prompt: `Plan ${title.trim()} and identify the required dependencies.`,
        implementation_prompt: `Implement ${title.trim()} according to the approved plan.`,
        validation_gate: `Validate that ${title.trim()} meets its documented acceptance criteria.`,
        sort_order: roadmapTree.roots.length,
        dependency_ids: [],
      }),
    });
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    setRoadmapTasks((current) => [...current, result.data]);
    setActiveRoadmapTaskId(result.data.id);
    router.refresh();
    setToast("Roadmap task created");
  }

  async function editRoadmapTaskLocally(task: RoadmapTask) {
    const title = window.prompt("Task title", task.title);
    if (title === null || !title.trim()) return;
    const description = window.prompt("Description", task.description ?? "");
    if (description === null) return;
    const estimate = window.prompt(
      "Estimate in minutes (leave blank for unestimated)",
      task.estimate_minutes?.toString() ?? "",
    );
    if (estimate === null) return;
    const estimateMinutes = estimate.trim() ? Number(estimate) : null;
    if (
      estimateMinutes !== null &&
      (!Number.isInteger(estimateMinutes) || estimateMinutes <= 0)
    ) {
      setToast("Estimate must be a positive number of minutes");
      return;
    }
    const planning = window.prompt("Planning prompt", task.planning_prompt);
    if (planning === null || !planning.trim()) return;
    const implementation = window.prompt(
      "Implementation prompt",
      task.implementation_prompt,
    );
    if (implementation === null || !implementation.trim()) return;
    const validation = window.prompt("Validation gate", task.validation_gate);
    if (validation === null || !validation.trim()) return;

    await updateRoadmapTask(task, {
      title: title.trim(),
      description: description.trim() || null,
      estimate_minutes: estimateMinutes,
      planning_prompt: planning.trim(),
      implementation_prompt: implementation.trim(),
      validation_gate: validation.trim(),
    });
  }

  const openTimeline = timeline.find((item) => item.id === openTimelineId) ?? null;
  const openTracker = openTimelineId?.startsWith("tracker-")
    ? trackerItems.find((item) => `tracker-${item.id}` === openTimelineId) ?? null
    : null;
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
            aria-label={hideRight ? "Show roadmap" : "Hide roadmap"}
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
              const parentNode = nodes.find((item) => item.id === node.parent_id);
              if (!parentNode) return null;
              const parentSize = nodeSize(parentNode);
              const childSize = nodeSize(node);
              const startX = parent.x + parentSize.width;
              const startY = parent.y + parentSize.height / 2;
              const endX = child.x;
              const endY = child.y + childSize.height / 2;
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
                style={{
                  left: positions[node.id]?.x ?? 0,
                  top: positions[node.id]?.y ?? 0,
                  width: nodeSize(node).width,
                  height: nodeSize(node).height,
                }}
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
                {isSelected ? (
                  <button
                    aria-label="Resize node"
                    className="node-resize-handle"
                    onPointerDown={(event) => handleResizePointerDown(event, node)}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    type="button"
                  />
                ) : null}
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
                {trackerTimelineLabel(
                  openTimeline,
                  granularity,
                  timeline.indexOf(openTimeline),
                  today,
                )}
                <span className={`kind-dot ${openTimeline.kind}`} />
                <span>{openTimeline.status}</span>
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
                  <strong>
                    {openTracker ? "Documentation update" : "Context understood"}
                  </strong>
                  <p>
                    {openTracker
                      ? openTracker.documentation_update
                      : "Linked to the current project plan and visible agent activity."}
                  </p>
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
              {openTracker ? (
                <button
                  className="add-button task-action-button"
                  disabled={
                    actioningTaskId !== null ||
                    openTracker.status === "actioned" ||
                    openTracker.status === "cancelled"
                  }
                  onClick={() => void actionTrackerItem(openTracker)}
                  type="button"
                >
                  <Icon name={openTracker.status === "actioned" ? "check" : "sparkle"} />
                  {actioningTaskId === openTracker.id
                    ? "Updating documentation…"
                    : openTracker.status === "actioned"
                      ? "Ready on roadmap"
                      : openTracker.status === "failed"
                        ? "Retry action"
                        : "Action task"}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Human plan</span>
                  <h2>Timeline</h2>
                </div>
                <button
                  className="add-button"
                  onClick={() => taskInputRef.current?.focus()}
                  type="button"
                >
                  <Icon name="plus" /> Add
                </button>
              </div>
              <form className="timeline-capture" onSubmit={addTimelineItem}>
                <input
                  aria-label="Describe tasks"
                  disabled={parsingTasks}
                  onChange={(event) => setTaskInput(event.target.value)}
                  placeholder="Describe a task, deadline, or client request…"
                  ref={taskInputRef}
                  value={taskInput}
                />
                <button
                  aria-label="Plan tasks with DeepSeek"
                  disabled={parsingTasks || taskInput.trim().length < 3}
                  type="submit"
                >
                  <Icon name="sparkle" />
                </button>
              </form>
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
                  <span>{fullCalendarDate(today)}</span>
                </div>
                {orderedTimeline.map((item, index) => (
                  <div className="timeline-slot" key={item.id}>
                    <span className="time-label">
                      {priorityMode
                        ? `P${6 - item.priority}`
                        : trackerTimelineLabel(item, granularity, index, today)}
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
                <button
                  className="empty-slot"
                  onClick={() => taskInputRef.current?.focus()}
                  type="button"
                >
                  <span>{timelineLabel(granularity, orderedTimeline.length)}</span>
                  <span className="timeline-rule" />
                  <span className="empty-note">
                    <Icon name="plus" /> Add a task
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
          {activeRoadmapTask ? (
            <div className="feature-detail">
              <button
                className="back-button"
                onClick={() => setActiveRoadmapTaskId(null)}
                type="button"
              >
                <Icon name="arrow-left" /> All roadmap tasks
              </button>
              <div className="detail-feature-heading">
                <span className={`status-icon ${activeRoadmapTask.status}`}>
                  <Icon name="sparkle" />
                </span>
                <div>
                  <span className="eyebrow">
                    {activeRoadmapTask.status.replace("_", " ")}
                  </span>
                  <h2>{activeRoadmapTask.title}</h2>
                </div>
              </div>
              <p className="feature-summary">
                {activeRoadmapTask.description || "No description added yet."}
              </p>
              <div className="detail-progress">
                <div>
                  <span>Overall progress</span>
                  <strong>{activeRoadmapTask.progress_percent}%</strong>
                </div>
                <div className="progress-track large">
                  <span
                    style={{ width: `${activeRoadmapTask.progress_percent}%` }}
                  />
                </div>
              </div>
              <div className="roadmap-estimate">
                <span>
                  {formatMinutes(estimatedRemainingMinutes(activeRoadmapTask))} remaining
                </span>
                <span>{formatMinutes(activeRoadmapTask.estimate_minutes)} estimated</span>
              </div>
              <div className="subtask-heading">
                <strong>Subtasks</strong>
                <span>
                  {activeRoadmapNode?.children.filter((task) => task.status === "done").length ?? 0}/
                  {activeRoadmapNode?.children.length ?? 0}
                </span>
              </div>
              <div className="subtask-list">
                {activeRoadmapNode?.children.length ? (
                  activeRoadmapNode.children.map((task) => (
                    <div
                      className={task.status === "done" ? "subtask done" : "subtask"}
                      key={task.id}
                    >
                      <span className="task-check">
                        {task.status === "done" ? <Icon name="check" size={13} /> : null}
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.status.replace("_", " ")} ·{" "}
                          {formatMinutes(estimatedRemainingMinutes(task))} remaining
                        </small>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No subtasks have been planned yet.</div>
                )}
              </div>
              <details className="roadmap-contract">
                <summary>Execution contract</summary>
                <div>
                  <strong>Planning</strong>
                  <p>{activeRoadmapTask.planning_prompt}</p>
                </div>
                <div>
                  <strong>Implementation</strong>
                  <p>{activeRoadmapTask.implementation_prompt}</p>
                </div>
                <div>
                  <strong>Validation gate</strong>
                  <p>{activeRoadmapTask.validation_gate}</p>
                </div>
              </details>
              <div className="roadmap-actions">
                <button
                  className="button-quiet"
                  disabled={updatingRoadmapTaskId === activeRoadmapTask.id}
                  onClick={() => void editRoadmapTaskLocally(activeRoadmapTask)}
                  type="button"
                >
                  Edit task
                </button>
                {activeRoadmapTask.status === "planned" ||
                activeRoadmapTask.status === "ready" ? (
                  <button
                    className="add-button"
                    disabled={updatingRoadmapTaskId === activeRoadmapTask.id}
                    onClick={() =>
                      void updateRoadmapTask(activeRoadmapTask, {
                        status: "in_progress",
                      })
                    }
                    type="button"
                  >
                    Start task
                  </button>
                ) : null}
                {activeRoadmapTask.status !== "done" ? (
                  <button
                    className="button-quiet"
                    disabled={updatingRoadmapTaskId === activeRoadmapTask.id}
                    onClick={() => {
                      if (window.confirm(`Mark “${activeRoadmapTask.title}” complete?`)) {
                        void updateRoadmapTask(activeRoadmapTask, {
                          status: "done",
                          progress_percent: 100,
                        });
                      }
                    }}
                    type="button"
                  >
                    Mark complete
                  </button>
                ) : null}
                <a className="button-quiet" href={`/tasks/${activeRoadmapTask.id}`}>
                  View dependency graph
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <span className="eyebrow">Agent plan</span>
                  <h2>Roadmap</h2>
                </div>
                <button
                  aria-label="Create roadmap task"
                  className="icon-button subtle"
                  onClick={() => void createRoadmapTaskLocally()}
                  type="button"
                >
                  <Icon name="plus" />
                </button>
              </div>
              <div className="feature-overview">
                <span>{roadmapTree.roots.length} top-level tasks</span>
                <a href="/tasks" aria-label="Open roadmap">
                  <Icon name="chevron" />
                </a>
              </div>
              <div className="feature-scroll">
                {roadmapTree.roots.map((task) => {
                  const remaining = estimatedRemainingMinutes(task);
                  return (
                    <button
                      className="feature-card"
                      key={task.id}
                      onClick={() => setActiveRoadmapTaskId(task.id)}
                      type="button"
                    >
                      <div className="feature-card-top">
                        <span className={`status-icon ${task.status}`}>
                          {task.status === "done" ? (
                            <Icon name="check" size={13} />
                          ) : (
                            <Icon name="sparkle" size={13} />
                          )}
                        </span>
                        <span className="feature-status">{task.status.replace("_", " ")}</span>
                        <Icon name="chevron" size={14} />
                      </div>
                      <strong>{task.title}</strong>
                      <span className="feature-description">
                        {task.description || "Execution details are being prepared."}
                      </span>
                      <div className="feature-progress">
                        <div className="progress-track">
                          <span style={{ width: `${task.progress_percent}%` }} />
                        </div>
                        <b>{task.progress_percent}%</b>
                      </div>
                      <span className="roadmap-card-meta">
                        {task.children.length} subtasks · {formatMinutes(remaining)} remaining
                      </span>
                    </button>
                  );
                })}
                {!roadmapTree.roots.length ? (
                  <div className="empty-state">
                    Action a timeline item to add it to the executable roadmap.
                  </div>
                ) : null}
              </div>
              <a className="new-feature" href="/tasks">
                Open roadmap <Icon name="chevron" />
              </a>
            </>
          )}
        </aside>
      ) : null}

      {editorNode ? (
        <div className="wireframe-editor-backdrop" role="presentation">
          <section
            aria-label={`Edit ${editorNode.title}`}
            aria-modal="true"
            className="wireframe-editor"
            role="dialog"
          >
            <header className="wireframe-editor-header">
              <div>
                <span className="eyebrow">Documentation</span>
                <strong>Edit note</strong>
              </div>
              <button
                aria-label="Close editor"
                className="icon-button"
                onClick={() => setEditorNodeId(null)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="wireframe-editor-fields">
              <label>
                Title
                <input
                  maxLength={160}
                  onChange={(event) => setEditorTitle(event.target.value)}
                  value={editorTitle}
                />
              </label>
              <label>
                Slug
                <input
                  onChange={(event) => setEditorSlug(event.target.value)}
                  value={editorSlug}
                />
              </label>
            </div>
            <div className="wireframe-markdown-editor">
              <MarkdownEditor
                markdown={editorMarkdown}
                nodeId={editorNode.id}
                onAssetUploaded={(asset) =>
                  setEditorAssets((current) => [...current, asset])
                }
                onChange={setEditorMarkdown}
              />
            </div>
            <div className="wireframe-assets">
              <div className="wireframe-assets-heading">
                <span>Images ({editorAssets.length})</span>
                <button onClick={() => uploadRef.current?.click()} type="button">
                  <Icon name="upload" size={13} /> Upload
                </button>
              </div>
              {editorAssets.length ? (
                <div className="wireframe-asset-grid">
                  {editorAssets.map((asset) => (
                    <figure key={asset.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={asset.alt_text ?? asset.original_filename} src={asset.signed_url} />
                      <figcaption>
                        <span>{asset.original_filename}</span>
                        <button
                          aria-label={`Archive ${asset.original_filename}`}
                          onClick={() => void archiveEditorAsset(asset)}
                          type="button"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p>No images attached.</p>
              )}
            </div>
            <footer className="wireframe-editor-footer">
              <span>v{editorNode.content_version}</span>
              <button className="button-quiet" onClick={() => setEditorNodeId(null)} type="button">
                Cancel
              </button>
              <button disabled={editorBusy} onClick={() => void saveEditor()} type="button">
                {editorBusy ? "Saving…" : "Save"}
              </button>
            </footer>
          </section>
        </div>
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
          <button onClick={() => setEditorNodeId(selectedNode.id)} type="button">
            <Icon name="note" /> Edit
          </button>
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
