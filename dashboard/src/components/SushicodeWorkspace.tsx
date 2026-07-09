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
  RoadmapTaskDependency,
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
type McpKeyRecord = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};
type Granularity = "hours" | "days" | "weeks";
type NotesTab = "overview" | "hours" | "days" | "time";
type LeftPanelMode = "chat" | "notes";
type WorkspaceModal = "task" | "feature" | "node" | null;
type NodeCreationType = "folder" | "document";
type TimelineItem = {
  id: string;
  title: string;
  note: string;
  priority: number;
  kind: "note" | "agent" | "task";
  status: string;
  scheduledFor: string;
};

const NODE_WIDTH = 300;
const NODE_HEIGHT = 170;
const TRACKER_PRIORITY: Record<TaskTrackerPriority, number> = {
  urgent: 5,
  high: 4,
  medium: 3,
  low: 2,
};

type TrackerApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; data?: TaskTrackerItem };

type TaskDraft = {
  title: string;
  description: string;
  priority: TaskTrackerPriority;
  scheduled_for: string;
  due_on: string;
  estimate_minutes: string;
};

type TaskActionResponse = {
  item: TaskTrackerItem;
  documentation: DocumentationNode;
  documentation_changes: Array<{
    operation: "created" | "updated";
    node: DocumentationNode;
  }>;
  agent_summary: string;
  roadmap: RoadmapTask;
};

type TaskActionReceipt = Pick<
  TaskActionResponse,
  "documentation_changes" | "agent_summary" | "roadmap"
> & { taskId: string };

function taskDraftFrom(item: TaskTrackerItem): TaskDraft {
  return {
    title: item.title,
    description: item.description,
    priority: item.priority,
    scheduled_for: item.scheduled_for,
    due_on: item.due_on ?? "",
    estimate_minutes: item.estimate_minutes?.toString() ?? "",
  };
}

function priorityFromLevel(level: number): TaskTrackerPriority {
  if (level >= 5) return "urgent";
  if (level === 4) return "high";
  if (level === 3) return "medium";
  return "low";
}

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
    | "mic"
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
    mic: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
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
    width: Math.max(node.canvas_width ?? NODE_WIDTH, NODE_WIDTH),
    height: Math.max(node.canvas_height ?? NODE_HEIGHT, NODE_HEIGHT),
  };
}

function trackerTimelineItem(item: TaskTrackerItem): TimelineItem {
  return {
    id: `tracker-${item.id}`,
    title: item.title,
    note: item.description,
    priority: TRACKER_PRIORITY[item.priority],
    kind: ["actioned", "completed"].includes(item.status) ? "task" : "note",
    status: item.status,
    scheduledFor: item.scheduled_for,
  };
}

function timelineDemoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function demoTimelineItems(): TimelineItem[] {
  return [
    {
      id: "demo-hour-ia-review",
      title: "Review IA branch labels",
      note: "Check that each canvas branch uses the same language as the user story.",
      priority: 5,
      kind: "note",
      status: "demo",
      scheduledFor: timelineDemoDate(0),
    },
    {
      id: "demo-hour-agent-handoff",
      title: "Write agent handoff note",
      note: "Capture the next prompt for turning notes into execution-ready work.",
      priority: 4,
      kind: "note",
      status: "demo",
      scheduledFor: timelineDemoDate(0),
    },
    {
      id: "demo-hour-ui-pass",
      title: "Polish canvas interactions",
      note: "Verify click-to-edit, delete guardrails, and sorted layout behavior.",
      priority: 3,
      kind: "task",
      status: "demo",
      scheduledFor: timelineDemoDate(0),
    },
    {
      id: "demo-day-roadmap-sync",
      title: "Sync roadmap tasks",
      note: "Connect the human notes to roadmap tasks and confirm the execution queue.",
      priority: 4,
      kind: "task",
      status: "demo",
      scheduledFor: timelineDemoDate(1),
    },
    {
      id: "demo-day-design-review",
      title: "Design review checkpoint",
      note: "Review panel density, light mode contrast, and note attachment flow.",
      priority: 3,
      kind: "note",
      status: "demo",
      scheduledFor: timelineDemoDate(2),
    },
    {
      id: "demo-day-client-update",
      title: "Prepare client update",
      note: "Summarize what changed in IA, timeline, and execution progress.",
      priority: 2,
      kind: "note",
      status: "demo",
      scheduledFor: timelineDemoDate(3),
    },
    {
      id: "demo-week-infra-plan",
      title: "Plan persistence polish",
      note: "Identify what note metadata needs first-class backend persistence.",
      priority: 3,
      kind: "task",
      status: "demo",
      scheduledFor: timelineDemoDate(7),
    },
    {
      id: "demo-week-agent-metrics",
      title: "Agent progress metrics",
      note: "Define how progress bars should reflect actual swarm execution.",
      priority: 2,
      kind: "task",
      status: "demo",
      scheduledFor: timelineDemoDate(14),
    },
    {
      id: "demo-week-launch-story",
      title: "Launch narrative",
      note: "Turn the workspace flow into a crisp demo story for the hackathon.",
      priority: 5,
      kind: "note",
      status: "demo",
      scheduledFor: timelineDemoDate(21),
    },
  ];
}

function buildTimeline(items: TaskTrackerItem[]): TimelineItem[] {
  const trackerItems = [...items]
    .sort(
      (a, b) =>
        a.scheduled_for.localeCompare(b.scheduled_for) ||
        TRACKER_PRIORITY[b.priority] - TRACKER_PRIORITY[a.priority],
    )
    .map(trackerTimelineItem);
  return [...trackerItems, ...demoTimelineItems()];
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
  const taskInputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNodeClickRef = useRef(false);
  const [nodeMenuId, setNodeMenuId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState<WorkspaceModal>(null);
  const [nodeDraft, setNodeDraft] = useState<{
    type: NodeCreationType;
    title: string;
    description: string;
  }>({ type: "document", title: "", description: "" });
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorSlug, setEditorSlug] = useState("");
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [editorAssets, setEditorAssets] = useState<WorkspaceAsset[]>([]);
  const [editorBusy, setEditorBusy] = useState(false);
  const [showMcpSetup, setShowMcpSetup] = useState(false);
  const [mcpKeys, setMcpKeys] = useState<McpKeyRecord[]>([]);
  const [mcpKeyName, setMcpKeyName] = useState("Cursor");
  const [newMcpKey, setNewMcpKey] = useState<string | null>(null);
  const [mcpKeyBusy, setMcpKeyBusy] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const syncEtag = useRef("");

  const [granularity, setGranularity] = useState<Granularity>("hours");
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>("chat");
  const [notesTab, setNotesTab] = useState<NotesTab>("overview");
  const [trackerItems, setTrackerItems] = useState(taskTrackerItems);
  const [timeline, setTimeline] = useState(() => buildTimeline(taskTrackerItems));
  const [openTimelineId, setOpenTimelineId] = useState<string | null>(null);
  const [attachedNoteId, setAttachedNoteId] = useState<string | null>(null);
  const [floatingAttach, setFloatingAttach] = useState<{
    itemId: string;
    left: number;
    top: number;
  } | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [parsingTasks, setParsingTasks] = useState(false);
  const [recordingTasks, setRecordingTasks] = useState(false);
  const [transcribingTasks, setTranscribingTasks] = useState(false);
  const [actioningTaskId, setActioningTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [trackerEditDraft, setTrackerEditDraft] = useState<TaskDraft | null>(
    null,
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTaskId, setDropTaskId] = useState<string | null>(null);
  const [actionReceipt, setActionReceipt] =
    useState<TaskActionReceipt | null>(null);
  const [modalTaskDraft, setModalTaskDraft] = useState({
    title: "",
    details: "",
    scheduledFor: localIsoDate(),
    priority: "medium" as TaskTrackerPriority,
  });

  const [roadmapTasks, setRoadmapTasks] = useState(roadmapBundle.tasks);
  const [roadmapDependencies, setRoadmapDependencies] = useState(
    roadmapBundle.dependencies,
  );
  const [activeRoadmapTaskId, setActiveRoadmapTaskId] = useState<string | null>(
    null,
  );
  const [updatingRoadmapTaskId, setUpdatingRoadmapTaskId] = useState<
    string | null
  >(null);
  const [featureDraft, setFeatureDraft] = useState<{
    title: string;
    summary: string;
    status: RoadmapTask["status"];
  }>({ title: "", summary: "", status: "planned" });

  useEffect(
    () => () => {
      if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    },
    [],
  );

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
  const prioritizedTimeline = [...timeline].sort((a, b) => b.priority - a.priority);
  const orderedTimeline =
    notesTab === "overview"
      ? prioritizedTimeline.slice(0, 5)
      : notesTab === "time"
        ? [...timeline].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        : timeline;
  const attachedNote = timeline.find((item) => item.id === attachedNoteId) ?? null;
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

  useEffect(() => {
    if (!backendEnabled) return;
    let stopped = false;
    let controller: AbortController | null = null;

    async function syncWorkspace() {
      if (
        stopped ||
        document.hidden ||
        editorNodeId ||
        editorBusy ||
        drag ||
        resize ||
        movingId ||
        updatingRoadmapTaskId
      ) {
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/workspace/sync", {
          cache: "no-store",
          headers: syncEtag.current ? { "If-None-Match": syncEtag.current } : {},
          signal: controller.signal,
        });
        if (response.status === 304) {
          setLastSyncedAt(new Date());
          return;
        }
        if (!response.ok) return;
        const body = (await response.json()) as {
          ok: boolean;
          documents: DocumentationNode[];
          roadmap: {
            tasks: RoadmapTask[];
            dependencies: RoadmapTaskDependency[];
          };
          synced_at: string;
        };
        if (!body.ok || stopped) return;
        syncEtag.current = response.headers.get("etag") ?? "";
        setNodes(body.documents);
        setPositions(initialPositions(body.documents));
        setRoadmapTasks(body.roadmap.tasks);
        setRoadmapDependencies(body.roadmap.dependencies);
        setSelectedId((current) =>
          current && body.documents.some((node) => node.id === current)
            ? current
            : body.documents[0]?.id ?? null,
        );
        setActiveRoadmapTaskId((current) =>
          current && body.roadmap.tasks.some((task) => task.id === current)
            ? current
            : null,
        );
        setLastSyncedAt(new Date(body.synced_at));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    void syncWorkspace();
    const interval = window.setInterval(() => void syncWorkspace(), 2_000);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [
    backendEnabled,
    drag,
    editorBusy,
    editorNodeId,
    movingId,
    resize,
    updatingRoadmapTaskId,
  ]);

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
    if (suppressNodeClickRef.current) {
      suppressNodeClickRef.current = false;
      return;
    }
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
    setEditorNodeId(node.id);
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
    const moved =
      Math.abs(event.clientX - drag.pointerX) > 4 ||
      Math.abs(event.clientY - drag.pointerY) > 4;
    suppressNodeClickRef.current = moved;
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

  function sortCanvasLayout() {
    const nextPositions: Record<string, Point> = {};
    const expandedIds = new Set<string>();
    let row = 0;

    const place = (node: DocumentationNode, depth: number) => {
      const size = nodeSize(node);
      nextPositions[node.id] = {
        x: 160 + depth * 390,
        y: 120 + row * 220,
      };
      row += Math.max(1, Math.ceil(size.height / 170));
      const children = childrenByParent.get(node.id) ?? [];
      if (children.length) expandedIds.add(node.id);
      for (const child of children) place(child, depth + 1);
    };

    for (const root of childrenByParent.get(null) ?? []) place(root, 0);
    setPositions((current) => ({ ...current, ...nextPositions }));
    setExpanded(expandedIds);
    setPan({ x: 250, y: 24 });
    setZoom(0.82);
    setToast("Canvas sorted into clean layers");

    if (backendEnabled) {
      void (async () => {
        for (const node of nodes) {
          const point = nextPositions[node.id];
          if (point && !node.id.startsWith("demo-")) {
            await persistNodeMove(node, point);
          }
        }
      })();
    }
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".ia-node, .canvas-controls")) return;
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

  async function addChild(
    title: string,
    description: string,
    type: NodeCreationType,
  ) {
    if (!title.trim()) return;
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
      markdown:
        description.trim() ||
        (type === "folder"
          ? "A new space for related documents and notes."
          : "New document — add context here."),
      sort_order: siblings.length,
      canvas_x: point.x,
      canvas_y: point.y,
      canvas_width: NODE_WIDTH,
      canvas_height: NODE_HEIGHT,
      canvas_metadata: { kind: type },
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
        canvas_metadata: draft.canvas_metadata,
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
        setToast(`${type === "folder" ? "Folder" : "Document"} added`);
        return;
      }
    }
    setNodes((current) => [...current, draft]);
    setPositions((current) => ({ ...current, [draft.id]: point }));
    if (parent) setExpanded((current) => new Set(current).add(parent.id));
    setSelectedId(draft.id);
    setToast(`${type === "folder" ? "Folder" : "Document"} added`);
  }

  function openNodeForm(type: NodeCreationType) {
    setNodeDraft({ type, title: "", description: "" });
    setAddMenuOpen(false);
    setNodeMenuId(null);
    setWorkspaceModal("node");
  }

  async function submitNodeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeDraft.title.trim()) return;
    await addChild(nodeDraft.title, nodeDraft.description, nodeDraft.type);
    setWorkspaceModal(null);
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

  async function transcribeTaskRecording(audio: Blob) {
    if (audio.size === 0) {
      setToast("No audio was captured. Try the microphone again.");
      return;
    }
    if (audio.size > 4 * 1024 * 1024) {
      setToast("The recording is too large. Keep task notes under one minute.");
      return;
    }

    setTranscribingTasks(true);
    setToast("Cloudflare is transcribing your task…");
    const formData = new FormData();
    formData.set(
      "audio",
      new File([audio], "task-recording", {
        type: audio.type || "audio/webm",
      }),
    );
    try {
      const response = await fetch("/api/task-tracker/transcribe", {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.ok || typeof body.data?.text !== "string") {
        setToast(body.error || "The recording could not be transcribed.");
        return;
      }
      const transcript = body.data.text.trim();
      setTaskInput((current) =>
        [current.trim(), transcript].filter(Boolean).join(" "),
      );
      setToast("Speech added to the task input");
      requestAnimationFrame(() => taskInputRef.current?.focus());
    } catch {
      setToast("The transcription service could not be reached.");
    } finally {
      setTranscribingTasks(false);
    }
  }

  async function toggleTaskRecording() {
    const current = mediaRecorderRef.current;
    if (current?.state === "recording") {
      current.stop();
      return;
    }
    if (transcribingTasks || parsingTasks) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setToast("This browser does not support microphone recording.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
        recorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setRecordingTasks(false);
        const audio = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        void transcribeTaskRecording(audio);
      };
      recorder.onerror = () => {
        setToast("Microphone recording failed. Try again.");
      };
      recorder.start();
      setRecordingTasks(true);
      setToast("Listening… click the microphone to stop");
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60_000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setToast("Microphone access was not granted.");
    }
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

  async function submitTaskInput(inputValue: string) {
    const input = inputValue.trim();
    if (input.length < 3) {
      setToast("Describe the note before adding it");
      taskInputRef.current?.focus();
      return false;
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
    if (!result.ok) {
      setParsingTasks(false);
      setToast(result.error);
      return false;
    }
    if (result.data.length === 0) {
      setParsingTasks(false);
      setToast("DeepSeek did not return a task. Try describing the outcome more explicitly.");
      return false;
    }

    const nextItems = [...trackerItems, ...result.data];
    setTrackerItems(nextItems);
    setTimeline(buildTimeline(nextItems));
    setTaskInput("");
    setToast("Creating the roadmap task…");
    const roadmap = await actionTrackerItem(result.data[0]);
    setParsingTasks(false);
    if (!roadmap) {
      setOpenTimelineId(`tracker-${result.data[0].id}`);
      return true;
    }
    router.push(`/tasks/${roadmap.id}`);
    return true;
  }

  async function submitTimelinePrompt() {
    const prompt = attachedNote
      ? [
          `Attached note: ${attachedNote.title}`,
          attachedNote.note,
          `Direction: ${taskInput}`,
        ].join("\n\n")
      : taskInput;
    if (await submitTaskInput(prompt)) setAttachedNoteId(null);
  }

  async function addTimelineItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitTimelinePrompt();
  }

  async function addStructuredTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = [
      modalTaskDraft.title,
      modalTaskDraft.details,
      `Schedule for ${modalTaskDraft.scheduledFor}.`,
      `Priority: ${modalTaskDraft.priority}.`,
    ]
      .filter(Boolean)
      .join("\n");
    if (await submitTaskInput(prompt)) {
      setModalTaskDraft({
        title: "",
        details: "",
        scheduledFor: localIsoDate(),
        priority: "medium",
      });
      setWorkspaceModal(null);
      setLeftPanelMode("notes");
      setNotesTab("overview");
    }
  }

  function attachNoteToPrompt(item: TimelineItem) {
    setFloatingAttach(null);
    setAttachedNoteId(item.id);
    setOpenTimelineId(null);
    setLeftPanelMode("chat");
    setTaskInput("");
    window.setTimeout(() => taskInputRef.current?.focus(), 0);
  }

  function replaceTrackerItem(updated: TaskTrackerItem) {
    setTrackerItems((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
    setTimeline((current) =>
      current.map((candidate) =>
        candidate.id === `tracker-${updated.id}`
          ? trackerTimelineItem(updated)
          : candidate,
      ),
    );
    setTrackerEditDraft(taskDraftFrom(updated));
  }

  async function mutateTrackerItem(
    item: TaskTrackerItem,
    body: Record<string, unknown>,
  ): Promise<TaskTrackerItem | null> {
    setSavingTaskId(item.id);
    const result = await trackerRequest<TaskTrackerItem>(
      `/api/task-tracker/${item.id}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    setSavingTaskId(null);
    if (!result.ok) {
      if (result.data) replaceTrackerItem(result.data);
      setToast(result.error);
      return null;
    }
    replaceTrackerItem(result.data);
    return result.data;
  }

  async function saveTaskDraft(item: TaskTrackerItem) {
    if (!trackerEditDraft) return;
    const estimate = trackerEditDraft.estimate_minutes.trim()
      ? Number(trackerEditDraft.estimate_minutes)
      : null;
    if (estimate !== null && (!Number.isInteger(estimate) || estimate <= 0)) {
      setToast("Effort must be a positive number of minutes.");
      return;
    }
    const updated = await mutateTrackerItem(item, {
      operation: "edit",
      expected_lock_version: item.lock_version,
      title: trackerEditDraft.title,
      description: trackerEditDraft.description,
      priority: trackerEditDraft.priority,
      scheduled_for: trackerEditDraft.scheduled_for,
      due_on: trackerEditDraft.due_on || null,
      estimate_minutes: estimate,
    });
    if (updated) setToast("Task edits saved");
  }

  async function completeTrackerItem(item: TaskTrackerItem) {
    const updated = await mutateTrackerItem(item, {
      operation: "complete",
      expected_lock_version: item.lock_version,
    });
    if (updated) setToast("Task marked complete");
  }

  async function deleteTrackerItem(item: TaskTrackerItem) {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setSavingTaskId(item.id);
    const result = await trackerRequest<TaskTrackerItem>(
      `/api/task-tracker/${item.id}`,
      {
        method: "DELETE",
        body: JSON.stringify({ expected_lock_version: item.lock_version }),
      },
    );
    setSavingTaskId(null);
    if (!result.ok) {
      if (result.data) replaceTrackerItem(result.data);
      setToast(result.error);
      return;
    }
    const remaining = trackerItems.filter(
      (candidate) => candidate.id !== item.id,
    );
    setTrackerItems(remaining);
    setTimeline(buildTimeline(remaining));
    setOpenTimelineId(null);
    setActionReceipt(null);
    setToast("Task deleted");
  }

  async function rescheduleTrackerItem(
    item: TaskTrackerItem,
    scheduledFor: string,
    requestedDueOn: string | null = item.due_on,
  ) {
    const dueOn =
      requestedDueOn === null
        ? null
        : requestedDueOn >= scheduledFor
          ? requestedDueOn
          : scheduledFor;
    if (item.scheduled_for === scheduledFor && item.due_on === dueOn) return;
    const updated = await mutateTrackerItem(item, {
      operation: "reschedule",
      expected_lock_version: item.lock_version,
      scheduled_for: scheduledFor,
      due_on: dueOn,
    });
    if (updated) {
      const next = trackerItems.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      );
      setTimeline(buildTimeline(next));
      setToast(`Rescheduled to ${formatTaskTrackerDate(scheduledFor, today)}`);
    }
  }

  async function actionTrackerItem(item: TaskTrackerItem): Promise<RoadmapTask | null> {
    setActioningTaskId(item.id);
    setActionReceipt(null);
    setToast("Reviewing project documentation…");
    const result = await trackerRequest<TaskActionResponse>(
      `/api/task-tracker/${item.id}/action`,
      {
        method: "POST",
        body: JSON.stringify({ expected_lock_version: item.lock_version }),
      },
    );
    setActioningTaskId(null);

    const updated = result.ok ? result.data.item : result.data;
    if (updated) {
      replaceTrackerItem(updated);
    }
    if (!result.ok) {
      setToast(result.error);
      return null;
    }
    const changedNodes = result.data.documentation_changes.map(
      (change) => change.node,
    );
    setNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      for (const node of changedNodes) byId.set(node.id, node);
      return [...byId.values()];
    });
    setPositions((current) => {
      const next = { ...current };
      for (const node of changedNodes) {
        next[node.id] = {
          x: node.canvas_x,
          y: node.canvas_y,
        };
      }
      return next;
    });
    if (changedNodes[0]) {
      setSelectedId(changedNodes[0].id);
      setExpanded((current) => {
        const next = new Set(current);
        const byId = new Map(
          [...nodes, ...changedNodes].map((node) => [node.id, node]),
        );
        for (const changed of changedNodes) {
          let parentId = changed.parent_id;
          while (parentId) {
            next.add(parentId);
            parentId = byId.get(parentId)?.parent_id ?? null;
          }
        }
        return next;
      });
    }
    setActionReceipt({
      taskId: item.id,
      documentation_changes: result.data.documentation_changes,
      agent_summary: result.data.agent_summary,
      roadmap: result.data.roadmap,
    });
    setRoadmapTasks((current) => {
      const roadmap = result.data.roadmap;
      return current.some((task) => task.id === roadmap.id)
        ? current.map((task) => (task.id === roadmap.id ? roadmap : task))
        : [...current, roadmap];
    });
    setActiveRoadmapTaskId(result.data.roadmap.id);
    router.refresh();
    setToast(
      `Updated ${changedNodes.length} ${changedNodes.length === 1 ? "document" : "documents"} · roadmap task ready`,
    );
    return result.data.roadmap;
  }

  async function createFeature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!featureDraft.title.trim()) return;
    void createRoadmapTaskFromDraft();
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

  async function createRoadmapTaskFromDraft() {
    const title = featureDraft.title.trim();
    if (!title) return;
    const result = await roadmapRequest<RoadmapTask>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        parent_task_id: null,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        title,
        description: featureDraft.summary.trim() || null,
        status: featureDraft.status,
        progress_percent: featureDraft.status === "done" ? 100 : 0,
        estimate_minutes: null,
        planning_prompt: `Plan ${title} and identify dependencies, risks, and acceptance criteria.`,
        implementation_prompt: `Implement ${title} according to the approved plan and update the workspace.`,
        validation_gate: `Validate that ${title} meets the documented outcome and has reviewed evidence.`,
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
    setFeatureDraft({ title: "", summary: "", status: "planned" });
    setWorkspaceModal(null);
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
  const openActionReceipt =
    openTracker && actionReceipt?.taskId === openTracker.id
      ? actionReceipt
      : null;

  useEffect(() => {
    setTrackerEditDraft(openTracker ? taskDraftFrom(openTracker) : null);
  }, [openTracker?.id, openTracker?.lock_version]);

  useEffect(() => {
    if (!showMcpSetup) return;
    setNewMcpKey(null);
    void fetch("/api/mcp/keys")
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) setMcpKeys(result.data as McpKeyRecord[]);
      });
  }, [showMcpSetup]);

  async function createPersonalMcpKey() {
    setMcpKeyBusy(true);
    const response = await fetch("/api/mcp/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mcpKeyName }),
    });
    const result = await response.json();
    setMcpKeyBusy(false);
    if (!response.ok || !result.ok) {
      setToast(result.error || "Unable to create MCP key");
      return;
    }
    setNewMcpKey(result.data.key as string);
    setMcpKeys((current) => [result.data as McpKeyRecord, ...current]);
  }

  async function revokePersonalMcpKey(id: string) {
    const response = await fetch(`/api/mcp/keys/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setToast("Unable to revoke MCP key");
      return;
    }
    setMcpKeys((current) =>
      current.map((key) =>
        key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key,
      ),
    );
    setToast("MCP key revoked");
  }

  const mcpUrl =
    typeof window === "undefined"
      ? "https://YOUR-VERCEL-DOMAIN/api/mcp"
      : `${window.location.origin}/api/mcp`;
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
          {lastSyncedAt
            ? `Docs + roadmap synced ${lastSyncedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "Docs + roadmap live"}
        </div>
        <div className="topbar-actions">
          <button
            className="mcp-connect-button"
            onClick={() => setShowMcpSetup(true)}
            type="button"
          >
            Connect MCP
          </button>
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
          <form action="/auth/logout" method="post">
            <button className="avatar" title="Sign out" type="submit">
              EA
            </button>
          </form>
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
            const isFolder =
              childCount > 0 || node.canvas_metadata.kind === "folder";
            const isOpen = expanded.has(node.id);
            const isSelected = node.id === selectedId;
            return (
              <div
                className={[
                  "ia-node",
                  isFolder ? "folder-node" : "document-node",
                  isSelected ? "selected" : "",
                  nodeMenuId === node.id ? "menu-open" : "",
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
                {isFolder ? <div className="folder-tab" /> : null}
                <div className="node-header">
                  <span className="node-icon">
                    <Icon name={isFolder ? "folder" : "file"} size={15} />
                  </span>
                  <span>{isFolder ? "Folder" : "Document"}</span>
                  <button
                    aria-label="More options"
                    aria-expanded={nodeMenuId === node.id}
                    className={nodeMenuId === node.id ? "node-more active" : "node-more"}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedId(node.id);
                      setNodeMenuId((current) => (current === node.id ? null : node.id));
                    }}
                    type="button"
                  >
                    <Icon name="more" />
                  </button>
                  {nodeMenuId === node.id ? (
                    <div
                      className="node-config-popover"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <div>
                        <strong>Item settings</strong>
                        <span>{node.slug}</span>
                      </div>
                      <button onClick={() => setEditorNodeId(node.id)} type="button">
                        <Icon name="note" /> Edit document
                      </button>
                      <button onClick={() => openNodeForm("document")} type="button">
                        <Icon name="plus" /> Add inside
                      </button>
                      <button
                        onClick={() => {
                          setMovingId(node.id);
                          setNodeMenuId(null);
                        }}
                        type="button"
                      >
                        <Icon name="move" /> Move item
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          setNodeMenuId(null);
                          void deleteSelected();
                        }}
                        type="button"
                      >
                        <Icon name="trash" /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                <h3>{node.title}</h3>
                <p>{node.markdown || "No detail added yet."}</p>
                <div className="node-footer">
                  <span>v{node.content_version}</span>
                  {isFolder ? (
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
          <button
            aria-label="Sort canvas into layers"
            className="sort-canvas-button"
            onClick={sortCanvasLayout}
            type="button"
          >
            Sort
          </button>
        </div>
      </div>

      {!hideLeft ? (
        <aside className="floating-panel timeline-panel notes-chat-panel">
          {openTimeline ? (
            <div className="panel-detail">
              <button
                className="back-button"
                onClick={() => setOpenTimelineId(null)}
                type="button"
              >
                <Icon name="arrow-left" /> Notes
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
              {openTracker && trackerEditDraft ? (
                <input
                  aria-label="Task title"
                  className="task-title-input"
                  disabled={!["pending", "failed"].includes(openTracker.status)}
                  maxLength={200}
                  onChange={(event) =>
                    setTrackerEditDraft((current) =>
                      current
                        ? { ...current, title: event.target.value }
                        : current,
                    )
                  }
                  value={trackerEditDraft.title}
                />
              ) : (
                <h2>{openTimeline.title}</h2>
              )}
              <label className="note-label">
                Note
                <textarea
                  onChange={(event) =>
                    setTrackerEditDraft((current) =>
                      current
                        ? { ...current, description: event.target.value }
                        : current,
                    )
                  }
                  disabled={
                    !openTracker ||
                    !["pending", "failed"].includes(openTracker.status)
                  }
                  value={trackerEditDraft?.description ?? openTimeline.note}
                />
              </label>
              {openTracker && trackerEditDraft ? (
                <div className="task-schedule-fields">
                  <label>
                    Scheduled
                    <input
                      disabled={[
                        "actioning",
                        "cancelled",
                        "completed",
                      ].includes(openTracker.status)}
                      onChange={(event) =>
                        setTrackerEditDraft((current) =>
                          current
                            ? {
                                ...current,
                                scheduled_for: event.target.value,
                              }
                            : current,
                        )
                      }
                      type="date"
                      value={trackerEditDraft.scheduled_for}
                    />
                  </label>
                  <label>
                    Due
                    <input
                      disabled={[
                        "actioning",
                        "cancelled",
                        "completed",
                      ].includes(openTracker.status)}
                      min={trackerEditDraft.scheduled_for}
                      onChange={(event) =>
                        setTrackerEditDraft((current) =>
                          current
                            ? { ...current, due_on: event.target.value }
                            : current,
                        )
                      }
                      type="date"
                      value={trackerEditDraft.due_on}
                    />
                  </label>
                  <label>
                    Minutes
                    <input
                      disabled={
                        !["pending", "failed"].includes(openTracker.status)
                      }
                      min="1"
                      onChange={(event) =>
                        setTrackerEditDraft((current) =>
                          current
                            ? {
                                ...current,
                                estimate_minutes: event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="—"
                      type="number"
                      value={trackerEditDraft.estimate_minutes}
                    />
                  </label>
                </div>
              ) : null}
              <div className="context-card">
                <Icon name="sparkle" />
                <div>
                  <strong>
                    {openActionReceipt
                      ? "Action complete"
                      : openTracker
                        ? "Documentation plan"
                        : "Context understood"}
                  </strong>
                  <p>
                    {openActionReceipt
                      ? openActionReceipt.agent_summary
                      : openTracker
                        ? openTracker.documentation_update
                      : "Linked to the current project plan and visible agent activity."}
                  </p>
                  {openActionReceipt ? (
                    <ul className="task-action-results">
                      {openActionReceipt.documentation_changes.map((change) => (
                        <li key={change.node.id}>
                          {change.operation === "created" ? "Created" : "Updated"}{" "}
                          <strong>{change.node.title}</strong>
                        </li>
                      ))}
                      <li>
                        Roadmap <strong>{openActionReceipt.roadmap.title}</strong>{" "}
                        is {openActionReceipt.roadmap.status}
                      </li>
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="detail-meta">
                <span>Priority</span>
                <div className="priority-bars">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      aria-label={`Set priority ${level}`}
                      className={
                        level <=
                        (trackerEditDraft
                          ? TRACKER_PRIORITY[trackerEditDraft.priority]
                          : openTimeline.priority)
                          ? "filled"
                          : ""
                      }
                      disabled={
                        !openTracker ||
                        !["pending", "failed"].includes(openTracker.status)
                      }
                      key={level}
                      onClick={() =>
                        setTrackerEditDraft((current) =>
                          current
                            ? {
                                ...current,
                                priority: priorityFromLevel(level),
                              }
                            : current,
                        )
                      }
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <button
                className="attach-detail-button"
                onClick={() => attachNoteToPrompt(openTimeline)}
                type="button"
              >
                <Icon name="sparkle" /> Attach to prompt
              </button>
              {openTracker ? (
                <div className="task-detail-actions">
                  <button
                    className="add-button"
                    disabled={
                      savingTaskId !== null ||
                      ["actioning", "cancelled", "completed"].includes(
                        openTracker.status,
                      )
                    }
                    onClick={() =>
                      ["pending", "failed"].includes(openTracker.status)
                        ? void saveTaskDraft(openTracker)
                        : void rescheduleTrackerItem(
                            openTracker,
                            trackerEditDraft?.scheduled_for ??
                              openTracker.scheduled_for,
                            trackerEditDraft?.due_on || null,
                          )
                    }
                    type="button"
                  >
                    {["pending", "failed"].includes(openTracker.status)
                      ? "Save"
                      : "Reschedule"}
                  </button>
                  <button
                    className="add-button"
                    disabled={
                      savingTaskId !== null ||
                      ["actioning", "cancelled", "completed"].includes(
                        openTracker.status,
                      )
                    }
                    onClick={() => void completeTrackerItem(openTracker)}
                    type="button"
                  >
                    <Icon name="check" />{" "}
                    {openTracker.status === "completed" ? "Completed" : "Complete"}
                  </button>
                  <button
                    className="add-button task-action-button"
                    disabled={
                      actioningTaskId !== null ||
                      openTracker.status === "actioned" ||
                      openTracker.status === "cancelled" ||
                      openTracker.status === "completed"
                    }
                    onClick={() => void actionTrackerItem(openTracker)}
                    type="button"
                  >
                    <Icon
                      name={
                        openTracker.status === "actioned" ? "check" : "sparkle"
                      }
                    />
                    {actioningTaskId === openTracker.id
                      ? "Reviewing docs…"
                      : openTracker.status === "actioned"
                        ? "Ready on roadmap"
                        : openTracker.status === "failed"
                          ? "Retry action"
                          : "Action task"}
                  </button>
                  <button
                    aria-label="Delete task"
                    className="task-delete-button"
                    disabled={
                      savingTaskId !== null ||
                      openTracker.status === "actioning"
                    }
                    onClick={() => void deleteTrackerItem(openTracker)}
                    type="button"
                  >
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="panel-header notes-panel-header">
                <div>
                  <span className="eyebrow">Human context</span>
                  <h2>{leftPanelMode === "chat" ? "Notes & chat" : "Timeline"}</h2>
                </div>
                <button
                  aria-label={leftPanelMode === "chat" ? "Show notes list" : "Show chat"}
                  className="icon-button subtle panel-more-button"
                  onClick={() =>
                    setLeftPanelMode((current) => (current === "chat" ? "notes" : "chat"))
                  }
                  type="button"
                >
                  <Icon name={leftPanelMode === "chat" ? "more" : "close"} />
                </button>
              </div>
              {leftPanelMode === "chat" ? (
                <>
                  <section className="notes-carousel-section">
                    <div className="notes-section-heading">
                      <span>Recent notes</span>
                      <button onClick={() => setLeftPanelMode("notes")} type="button">
                        View all
                      </button>
                    </div>
                    <div className="notes-carousel">
                      {prioritizedTimeline.slice(0, 4).map((item) => (
                        <button
                          className="note-preview-card"
                          key={item.id}
                          onClick={() => setOpenTimelineId(item.id)}
                          type="button"
                        >
                          <span className={`kind-dot ${item.kind}`} />
                          <strong>{item.title}</strong>
                          <p>{item.note}</p>
                          <small>
                            {trackerTimelineLabel(
                              item,
                              "days",
                              timeline.indexOf(item),
                              today,
                            )}
                          </small>
                        </button>
                      ))}
                    </div>
                  </section>
                  <div className="chat-thread">
                    <div className="assistant-message">
                      <span className="assistant-mark"><Icon name="sparkle" /></span>
                      <div>
                        <strong>Let’s capture your first note.</strong>
                        <p>
                          Tell me what changed, what you are thinking about, or what
                          should happen next. I’ll structure it and connect it to the
                          project.
                        </p>
                      </div>
                    </div>
                    {attachedNote ? (
                      <div className="attached-note">
                        <div>
                          <span>Attached note</span>
                          <strong>{attachedNote.title}</strong>
                        </div>
                        <button
                          aria-label="Remove attached note"
                          onClick={() => setAttachedNoteId(null)}
                          type="button"
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <form className="chat-composer" onSubmit={addTimelineItem}>
                    {attachedNote ? (
                      <div className="prompt-presets">
                        {["Turn into MD", "Generate image", "Create feature", "Make task"].map(
                          (preset) => (
                            <button
                              key={preset}
                              onClick={() => setTaskInput(`${preset}: `)}
                              type="button"
                            >
                              {preset}
                            </button>
                          ),
                        )}
                      </div>
                    ) : null}
                    <textarea
                      aria-label="Message Sushicode"
                      disabled={parsingTasks}
                      onChange={(event) => setTaskInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "Enter" ||
                          event.shiftKey ||
                          event.nativeEvent.isComposing ||
                          parsingTasks
                        ) {
                          return;
                        }
                        event.preventDefault();
                        if (taskInput.trim().length >= 3) void submitTimelinePrompt();
                      }}
                      placeholder={
                        attachedNote
                          ? "What should I do with this note?"
                          : "Write a note or ask Sushicode…"
                      }
                      ref={taskInputRef}
                      rows={3}
                      value={taskInput}
                    />
                    {recordingTasks ? (
                      <p aria-live="polite" className="voice-recording-hint">
                        Listening — tap <strong>Stop</strong> to add the transcript
                        to this text field.
                      </p>
                    ) : transcribingTasks ? (
                      <p aria-live="polite" className="voice-recording-hint">
                        Transcribing into this text field…
                      </p>
                    ) : null}
                    <div className="composer-actions">
                      <button
                        aria-label={
                          recordingTasks
                            ? "Stop recording"
                            : transcribingTasks
                              ? "Transcribing recording"
                              : "Start voice input"
                        }
                        aria-pressed={recordingTasks}
                        className={
                          recordingTasks
                            ? "voice-button recording"
                            : "voice-button"
                        }
                        disabled={parsingTasks || transcribingTasks}
                        onClick={() => void toggleTaskRecording()}
                        title={
                          recordingTasks
                            ? "Stop recording and add speech to the text field"
                            : "Record speech into the text field"
                        }
                        type="button"
                      >
                        {recordingTasks ? (
                          <>
                            <Icon name="close" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <Icon name="mic" />
                        )}
                      </button>
                      <button
                        className="open-item-form"
                        onClick={() => setWorkspaceModal("task")}
                        type="button"
                      >
                        <Icon name="plus" /> Add item
                      </button>
                      <button
                        aria-label="Send prompt"
                        className="send-button"
                        disabled={parsingTasks || taskInput.trim().length < 3}
                        type="submit"
                      >
                        <Icon name="sparkle" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="notes-list-toolbar">
                    <button
                      className="timeline-pill"
                      onClick={() => setLeftPanelMode("chat")}
                      type="button"
                    >
                      <Icon name="sparkle" /> Chat
                    </button>
                    <button
                      className="add-button"
                      onClick={() => setWorkspaceModal("task")}
                      type="button"
                    >
                      <Icon name="plus" /> Add item
                    </button>
                  </div>
                  <div className="notes-tabs">
                    {(
                      [
                        ["overview", "Overview"],
                        ["hours", "By hour"],
                        ["days", "By day"],
                        ["time", "By time"],
                      ] as Array<[NotesTab, string]>
                    ).map(([value, label]) => (
                      <button
                        className={notesTab === value ? "active" : ""}
                        key={value}
                        onClick={() => {
                          setNotesTab(value);
                          if (value === "hours") setGranularity("hours");
                          if (value === "days") setGranularity("days");
                          if (value === "time") setGranularity("weeks");
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="notes-list-heading">
                    <div>
                      <span>{notesTab === "overview" ? "What’s next" : "Timeline"}</span>
                      <strong>
                        {notesTab === "overview"
                          ? "5 highest-priority notes"
                          : fullCalendarDate(today)}
                      </strong>
                    </div>
                    <span>{orderedTimeline.length}</span>
                  </div>
                  <div
                    className="notes-list"
                    onScroll={() => setFloatingAttach(null)}
                  >
                    {orderedTimeline.map((item, index) => {
                      const tracker = item.id.startsWith("tracker-")
                        ? trackerItems.find(
                            (candidate) =>
                              `tracker-${candidate.id}` === item.id,
                          )
                        : null;
                      const canDrag =
                        tracker &&
                        !["actioning", "cancelled", "completed"].includes(
                          tracker.status,
                        );
                      return (
                      <div
                        className={
                          dropTaskId === tracker?.id
                            ? "notes-list-row drop-target"
                            : "notes-list-row"
                        }
                        key={item.id}
                        onMouseEnter={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setFloatingAttach({
                            itemId: item.id,
                            left: rect.right + 10,
                            top: rect.top + rect.height / 2,
                          });
                        }}
                        onDragOver={(event) => {
                          if (!draggedTaskId || !tracker) return;
                          event.preventDefault();
                          setDropTaskId(tracker.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const source = trackerItems.find(
                            (candidate) => candidate.id === draggedTaskId,
                          );
                          setDraggedTaskId(null);
                          setDropTaskId(null);
                          if (source && tracker) {
                            void rescheduleTrackerItem(
                              source,
                              tracker.scheduled_for,
                            );
                          }
                        }}
                      >
                        <button
                          className={
                            draggedTaskId === tracker?.id
                              ? "notes-list-card dragging"
                              : "notes-list-card"
                          }
                          draggable={Boolean(canDrag)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDropTaskId(null);
                          }}
                          onDragStart={(event) => {
                            if (!tracker || !canDrag) {
                              event.preventDefault();
                              return;
                            }
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", tracker.id);
                            setDraggedTaskId(tracker.id);
                          }}
                          onClick={() => setOpenTimelineId(item.id)}
                          title={
                            canDrag
                              ? "Open task or drag onto another date to reschedule"
                              : "Open task"
                          }
                          type="button"
                        >
                          <span className={`kind-dot ${item.kind}`} />
                          <span>
                            <strong>{item.title}</strong>
                            <small>
                              {trackerTimelineLabel(
                                item,
                                notesTab === "hours"
                                  ? "hours"
                                  : notesTab === "days"
                                    ? "days"
                                    : "weeks",
                                index,
                                today,
                              )}
                            </small>
                          </span>
                          <p>{item.note}</p>
                        </button>
                      </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      ) : null}

      {floatingAttach && leftPanelMode === "notes" && !openTimeline ? (
        <button
          className="floating-attach-button"
          onClick={() => {
            const item = timeline.find(
              (candidate) => candidate.id === floatingAttach.itemId,
            );
            if (item) attachNoteToPrompt(item);
          }}
          onMouseLeave={() => setFloatingAttach(null)}
          style={{ left: floatingAttach.left, top: floatingAttach.top }}
          type="button"
        >
          <Icon name="plus" /> Attach to prompt
        </button>
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
                  onClick={() => setWorkspaceModal("feature")}
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
              <button
                className="new-feature"
                onClick={() => setWorkspaceModal("feature")}
                type="button"
              >
                <Icon name="plus" /> Create roadmap task
              </button>
            </>
          )}
        </aside>
      ) : null}

      {workspaceModal ? (
        <div
          className="workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setWorkspaceModal(null);
          }}
          role="presentation"
        >
          {workspaceModal === "task" ? (
            <form className="workspace-modal" onSubmit={addStructuredTask}>
              <header>
                <div>
                  <span className="eyebrow">New timeline item</span>
                  <h2>Add a note</h2>
                </div>
                <button
                  aria-label="Close"
                  className="icon-button"
                  onClick={() => setWorkspaceModal(null)}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </header>
              <div className="workspace-form">
                <label>
                  Title
                  <input
                    autoFocus
                    onChange={(event) =>
                      setModalTaskDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="What needs your attention?"
                    required
                    value={modalTaskDraft.title}
                  />
                </label>
                <label>
                  Context
                  <textarea
                    onChange={(event) =>
                      setModalTaskDraft((current) => ({
                        ...current,
                        details: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" ||
                        event.shiftKey ||
                        event.nativeEvent.isComposing ||
                        parsingTasks
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }}
                    placeholder="Add decisions, constraints, or desired outcome…"
                    rows={4}
                    value={modalTaskDraft.details}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Schedule
                    <input
                      onChange={(event) =>
                        setModalTaskDraft((current) => ({
                          ...current,
                          scheduledFor: event.target.value,
                        }))
                      }
                      type="date"
                      value={modalTaskDraft.scheduledFor}
                    />
                  </label>
                  <label>
                    Priority
                    <select
                      onChange={(event) =>
                        setModalTaskDraft((current) => ({
                          ...current,
                          priority: event.target.value as TaskTrackerPriority,
                        }))
                      }
                      value={modalTaskDraft.priority}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                </div>
              </div>
              <footer>
                <span>AI will structure this into the project timeline.</span>
                <button onClick={() => setWorkspaceModal(null)} type="button">Cancel</button>
                <button className="primary" disabled={parsingTasks} type="submit">
                  {parsingTasks ? "Adding…" : "Add note"}
                </button>
              </footer>
            </form>
          ) : null}

          {workspaceModal === "feature" ? (
            <form className="workspace-modal" onSubmit={createFeature}>
              <header>
                <div>
                  <span className="eyebrow">Agent plan</span>
                  <h2>Create roadmap task</h2>
                </div>
                <button
                  aria-label="Close"
                  className="icon-button"
                  onClick={() => setWorkspaceModal(null)}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </header>
              <div className="workspace-form">
                <label>
                  Task name
                  <input
                    autoFocus
                    onChange={(event) =>
                      setFeatureDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="e.g. Collaborative canvas presence"
                    required
                    value={featureDraft.title}
                  />
                </label>
                <label>
                  Outcome and context
                  <textarea
                    onChange={(event) =>
                      setFeatureDraft((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="What should be true when this task is complete?"
                    rows={5}
                    value={featureDraft.summary}
                  />
                </label>
                <label>
                  Initial status
                  <select
                    onChange={(event) =>
                      setFeatureDraft((current) => ({
                        ...current,
                        status: event.target.value as RoadmapTask["status"],
                      }))
                    }
                    value={featureDraft.status}
                  >
                    <option value="planned">Planned</option>
                    <option value="ready">Ready</option>
                    <option value="in_progress">In progress</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
              </div>
              <footer>
                <span>The planning agent can expand this into execution steps.</span>
                <button onClick={() => setWorkspaceModal(null)} type="button">Cancel</button>
                <button className="primary" type="submit">Create task</button>
              </footer>
            </form>
          ) : null}

          {workspaceModal === "node" ? (
            <form className="workspace-modal" onSubmit={submitNodeDraft}>
              <header>
                <div>
                  <span className="eyebrow">Information architecture</span>
                  <h2>Add to canvas</h2>
                </div>
                <button
                  aria-label="Close"
                  className="icon-button"
                  onClick={() => setWorkspaceModal(null)}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </header>
              <div className="workspace-form">
                <div className="type-segmented" role="group" aria-label="Item type">
                  {(["folder", "document"] as NodeCreationType[]).map((type) => (
                    <button
                      className={nodeDraft.type === type ? "active" : ""}
                      key={type}
                      onClick={() =>
                        setNodeDraft((current) => ({ ...current, type }))
                      }
                      type="button"
                    >
                      <Icon name={type === "folder" ? "folder" : "file"} />
                      {type}
                    </button>
                  ))}
                </div>
                <label>
                  Name
                  <input
                    autoFocus
                    onChange={(event) =>
                      setNodeDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder={
                      nodeDraft.type === "folder" ? "Folder name" : "Document title"
                    }
                    required
                    value={nodeDraft.title}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    onChange={(event) =>
                      setNodeDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Add a short purpose or starting context…"
                    rows={4}
                    value={nodeDraft.description}
                  />
                </label>
                <div className="parent-preview">
                  <span>Parent</span>
                  <strong>{selectedNode?.title ?? "Canvas root"}</strong>
                </div>
              </div>
              <footer>
                <span>You can move and nest this item later.</span>
                <button onClick={() => setWorkspaceModal(null)} type="button">Cancel</button>
                <button className="primary" type="submit">
                  Add {nodeDraft.type}
                </button>
              </footer>
            </form>
          ) : null}
        </div>
      ) : null}

      {showMcpSetup ? (
        <div className="wireframe-editor-backdrop" role="presentation">
          <section
            aria-label="Connect an agent with MCP"
            aria-modal="true"
            className="mcp-setup"
            role="dialog"
          >
            <header className="wireframe-editor-header">
              <div>
                <span className="eyebrow">Agent access</span>
                <strong>Connect Sushicode MCP</strong>
              </div>
              <button
                aria-label="Close MCP setup"
                className="icon-button"
                onClick={() => setShowMcpSetup(false)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </header>
            <div className="mcp-setup-body">
              <p>
                This remote MCP lets agents read and edit documentation and roadmap
                tasks. Writes use optimistic lock versions to prevent accidental
                overwrites.
              </p>
              <label>
                Create a personal key
                <div className="mcp-copy-row">
                  <input
                    maxLength={80}
                    onChange={(event) => setMcpKeyName(event.target.value)}
                    value={mcpKeyName}
                  />
                  <button
                    disabled={mcpKeyBusy}
                    onClick={() => void createPersonalMcpKey()}
                    type="button"
                  >
                    {mcpKeyBusy ? "Creating…" : "Create"}
                  </button>
                </div>
              </label>
              {newMcpKey ? (
                <label>
                  Copy now—this key will not be shown again
                  <div className="mcp-copy-row">
                    <code>{newMcpKey}</code>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(newMcpKey);
                        setToast("Personal MCP key copied");
                      }}
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                </label>
              ) : null}
              {mcpKeys.length ? (
                <div className="mcp-key-list">
                  {mcpKeys.map((key) => (
                    <div key={key.id}>
                      <span>
                        <strong>{key.name}</strong>
                        <small>{key.key_prefix}••••••••</small>
                      </span>
                      {key.revoked_at ? (
                        <em>Revoked</em>
                      ) : (
                        <button
                          onClick={() => void revokePersonalMcpKey(key.id)}
                          type="button"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              <label>
                Remote server URL
                <div className="mcp-copy-row">
                  <code>{mcpUrl}</code>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(mcpUrl);
                      setToast("MCP URL copied");
                    }}
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </label>
              <label>
                Cursor <code>mcp.json</code>
                <pre>{JSON.stringify(
                  {
                    mcpServers: {
                      sushicode: {
                        url: mcpUrl,
                        headers: {
                          Authorization: `Bearer ${newMcpKey ?? "YOUR_PERSONAL_MCP_KEY"}`,
                          "MCP-Protocol-Version": "2025-11-25",
                        },
                      },
                    },
                  },
                  null,
                  2,
                )}</pre>
              </label>
              <p className="mcp-security-note">
                Keys are stored as one-way hashes and can be revoked immediately.
                Treat the one-time value like a password.
              </p>
            </div>
          </section>
        </div>
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
                name={
                  (childrenByParent.get(selectedNode.id) ?? []).length ||
                  selectedNode.canvas_metadata.kind === "folder"
                    ? "folder"
                    : "file"
                }
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
          <button
            className={addMenuOpen ? "active" : ""}
            onClick={() => setAddMenuOpen((current) => !current)}
            type="button"
          >
            <Icon name="plus" /> Add
          </button>
          {addMenuOpen ? (
            <div className="add-type-menu">
              <div>
                <span>Add to {selectedNode.title}</span>
                <strong>Choose what to create</strong>
              </div>
              <button onClick={() => openNodeForm("folder")} type="button">
                <span className="node-icon"><Icon name="folder" /></span>
                <span><strong>Folder</strong><small>Group nested project notes</small></span>
              </button>
              <button onClick={() => openNodeForm("document")} type="button">
                <span className="node-icon document"><Icon name="file" /></span>
                <span><strong>Document</strong><small>Create an editable Markdown note</small></span>
              </button>
              <button
                onClick={() => {
                  setAddMenuOpen(false);
                  uploadRef.current?.click();
                }}
                type="button"
              >
                <span className="node-icon image"><Icon name="upload" /></span>
                <span><strong>Image</strong><small>Upload and attach a visual</small></span>
              </button>
            </div>
          ) : null}
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
