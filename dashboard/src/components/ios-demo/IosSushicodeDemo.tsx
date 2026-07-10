"use client";

import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BatteryFullRoundedIcon from "@mui/icons-material/BatteryFullRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DonutLargeRoundedIcon from "@mui/icons-material/DonutLargeRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SignalCellularAltRoundedIcon from "@mui/icons-material/SignalCellularAltRounded";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import styles from "./IosSushicodeDemo.module.css";

type TemporalFilter = "overview" | "today" | "week" | "month";
type AppTab = "notes" | "progress";
type Note = {
  id: string;
  title: string;
  excerpt: string;
  body: string[];
  time: string;
  context: string;
  period: Exclude<TemporalFilter, "overview">;
  image?: boolean;
};
type Subtask = {
  title: string;
  owner: string;
  progress: number;
  status: "done" | "active" | "queued";
};
type ProjectTask = {
  id: string;
  key: string;
  title: string;
  summary: string;
  lane: "In progress" | "Review" | "Queued";
  priority: "P0" | "P1" | "P2";
  progress: number;
  scope: string;
  stack: string[];
  ship: string;
  branch: string;
  updated: string;
  agentNote: string;
  subtasks: Subtask[];
};

const initialNotes: Note[] = [
  {
    id: "mobile-context",
    title: "Mobile context should feel ambient",
    excerpt:
      "The phone should answer: what changed, what is blocked, and where can I add useful context?",
    body: [
      "The mobile surface is not a smaller desktop IDE. It is a context and intervention layer for moments between focused work.",
      "Lead with the latest meaningful change. Keep infrastructure visible but compressed, then offer one clear place to inject a thought, decision, or correction.",
      "A raw note should remain lightweight until I deliberately turn it into a prompt, document, feature, or execution instruction.",
    ],
    time: "8 min",
    context: "Product direction",
    period: "today",
  },
  {
    id: "deploy-observability",
    title: "Deployment observability",
    excerpt:
      "Show the active branch, environment health, and last agent action without making the UI feel like a dashboard.",
    body: [
      "Progress is useful only when it gives the human enough context to make a decision.",
      "For deployment work, surface branch, target environment, current risk, and the last action taken. Logs remain one layer deeper.",
    ],
    time: "34 min",
    context: "Infrastructure",
    period: "today",
    image: true,
  },
  {
    id: "note-to-plan",
    title: "Note → plan handoff",
    excerpt:
      "When a note becomes a plan, preserve the original thought beside the agent interpretation.",
    body: [
      "The system should never silently replace human language with agent language.",
      "Keep the source note attached to the generated plan so assumptions are easy to inspect and correct.",
    ],
    time: "Yesterday",
    context: "Interaction model",
    period: "week",
  },
  {
    id: "permissions",
    title: "Agent permission boundaries",
    excerpt:
      "Use small, legible checkpoints before actions that touch production data or shared contracts.",
    body: [
      "Permission prompts should describe impact, reversibility, and the exact resource the agent will change.",
      "Low-risk local work can continue autonomously. Shared contracts and production mutations require an explicit checkpoint.",
    ],
    time: "Tue",
    context: "Safety",
    period: "week",
  },
  {
    id: "memory-layer",
    title: "Project memory layer",
    excerpt:
      "Decisions, rejected paths, and temporary constraints need different retention rules.",
    body: [
      "A useful project memory is selective. Decisions persist, rejected paths remain searchable, and temporary constraints expire.",
      "Notes are the inbox for this memory system; agents can suggest where each piece belongs.",
    ],
    time: "Jun 28",
    context: "System design",
    period: "month",
  },
];

const projectTasks: ProjectTask[] = [
  {
    id: "ios-companion",
    key: "IOS-142",
    title: "iOS companion experience",
    summary: "Ship the mobile context, notes, and intervention loop.",
    lane: "In progress",
    priority: "P0",
    progress: 68,
    scope: "Notes inbox, note-to-prompt handoff, task context, and safe agent intervention.",
    stack: ["Next.js", "React", "Supabase", "Agent API"],
    ship: "Jul 14",
    branch: "feat/mobile-shell",
    updated: "Agent active 2 min ago",
    agentNote:
      "The navigation shell and note model are stable. I am validating the swipe handoff before connecting live task events.",
    subtasks: [
      { title: "Navigation and safe-area shell", owner: "UI agent", progress: 100, status: "done" },
      { title: "Temporal note filters", owner: "UI agent", progress: 84, status: "active" },
      { title: "Note-to-prompt handoff", owner: "Planner agent", progress: 62, status: "active" },
      { title: "Live task event stream", owner: "Infra agent", progress: 28, status: "active" },
      { title: "Production permission gate", owner: "Safety agent", progress: 0, status: "queued" },
    ],
  },
  {
    id: "project-memory",
    key: "MEM-86",
    title: "Project memory pipeline",
    summary: "Turn unstructured notes into durable, inspectable context.",
    lane: "Review",
    priority: "P0",
    progress: 43,
    scope: "Classify notes, preserve source context, and attach decisions to project entities.",
    stack: ["Postgres", "Embeddings", "Workers"],
    ship: "Jul 18",
    branch: "feat/context-index",
    updated: "Waiting for review",
    agentNote:
      "The indexing contract is drafted. Human review is needed on retention categories before the backfill runs.",
    subtasks: [
      { title: "Source note schema", owner: "Data agent", progress: 100, status: "done" },
      { title: "Context classifier", owner: "Planner agent", progress: 55, status: "active" },
      { title: "Retention rules", owner: "Human review", progress: 30, status: "active" },
      { title: "Historical backfill", owner: "Data agent", progress: 0, status: "queued" },
    ],
  },
  {
    id: "deploy-bridge",
    key: "INF-219",
    title: "Deployment context bridge",
    summary: "Explain environment health and agent actions in human terms.",
    lane: "In progress",
    priority: "P1",
    progress: 86,
    scope: "Environment summaries, deploy state, risk flags, and reversible intervention controls.",
    stack: ["Cloudflare", "GitHub", "OpenTelemetry"],
    ship: "Jul 11",
    branch: "feat/deploy-context",
    updated: "Last check passed",
    agentNote:
      "Staging is healthy. One production rollback edge case remains before the feature can move to approval.",
    subtasks: [
      { title: "Environment health adapter", owner: "Infra agent", progress: 100, status: "done" },
      { title: "Human-readable event summary", owner: "Planner agent", progress: 100, status: "done" },
      { title: "Rollback edge case", owner: "Infra agent", progress: 68, status: "active" },
      { title: "Production approval copy", owner: "Human review", progress: 45, status: "active" },
    ],
  },
  {
    id: "voice-capture",
    key: "IOS-157",
    title: "Voice idea capture",
    summary: "Capture a thought quickly and keep the transcript editable.",
    lane: "Queued",
    priority: "P2",
    progress: 21,
    scope: "Streaming transcription, note cleanup suggestions, and source audio retention.",
    stack: ["Web Audio", "Whisper", "Storage"],
    ship: "Jul 22",
    branch: "feat/voice-notes",
    updated: "Queued behind memory work",
    agentNote:
      "Audio capture works locally. The next step is selecting a retention policy for source recordings.",
    subtasks: [
      { title: "Audio capture prototype", owner: "UI agent", progress: 100, status: "done" },
      { title: "Streaming transcription", owner: "Media agent", progress: 34, status: "active" },
      { title: "Transcript cleanup", owner: "Planner agent", progress: 0, status: "queued" },
      { title: "Retention controls", owner: "Human review", progress: 0, status: "queued" },
    ],
  },
];

const filters: Array<{ id: TemporalFilter; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

function StatusBar() {
  return (
    <div className={styles.statusBar} aria-hidden="true">
      <span>9:41</span>
      <div>
        <SignalCellularAltRoundedIcon />
        <WifiRoundedIcon />
        <BatteryFullRoundedIcon />
      </div>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={`${styles.iconButton} ${className}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      aria-label={`${value}% complete`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className={styles.progressTrack}
      role="progressbar"
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function ImagePlaceholder() {
  return (
    <div className={styles.imagePlaceholder} aria-label="Image placeholder">
      <ImageOutlinedIcon />
      <span>Reference image</span>
    </div>
  );
}

export function IosSushicodeDemo() {
  const [activeTab, setActiveTab] = useState<AppTab>("notes");
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>("overview");
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [chatNoteId, setChatNoteId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; x: number } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [activeFormat, setActiveFormat] = useState<"bold" | "italic" | "list" | null>(
    null,
  );
  const pointerStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const chatNote = notes.find((note) => note.id === chatNoteId) ?? null;
  const selectedTask = projectTasks.find((task) => task.id === selectedTaskId) ?? null;
  const visibleNotes = useMemo(() => {
    if (temporalFilter === "overview") return notes;
    const accepted: Record<Exclude<TemporalFilter, "overview">, Note["period"][]> = {
      today: ["today"],
      week: ["today", "week"],
      month: ["today", "week", "month"],
    };
    return notes.filter((note) => accepted[temporalFilter].includes(note.period));
  }, [notes, temporalFilter]);

  function resetToTab(tab: AppTab) {
    setActiveTab(tab);
    setSelectedNoteId(null);
    setChatNoteId(null);
    setSelectedTaskId(null);
    setSwipe(null);
  }

  function beginSwipe(event: PointerEvent<HTMLButtonElement>, note: Note) {
    pointerStartRef.current = { id: note.id, x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSwipe(event: PointerEvent<HTMLButtonElement>, note: Note) {
    const start = pointerStartRef.current;
    if (!start || start.id !== note.id) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX <= 0 || Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (deltaX > 6) suppressClickRef.current = true;
    setSwipe({ id: note.id, x: Math.min(deltaX, 112) });
  }

  function endSwipe(note: Note) {
    if (swipe?.id === note.id && swipe.x > 72) {
      setChatNoteId(note.id);
      setChatMessages([]);
      setSelectedNoteId(null);
    }
    setSwipe(null);
    pointerStartRef.current = null;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function createNote() {
    const draft: Note = {
      id: `draft-${Date.now()}`,
      title: "Untitled thought",
      excerpt: "Start writing. Sushicode will keep this unstructured until you choose what it becomes.",
      body: ["Start writing your note here…"],
      time: "Now",
      context: "Draft",
      period: "today",
    };
    setNotes((current) => [draft, ...current]);
    setSelectedNoteId(draft.id);
  }

  function sendChatMessage() {
    const message = chatInput.trim();
    if (!message) return;
    setChatMessages((current) => [...current, message]);
    setChatInput("");
  }

  function openNoteInChat(note: Note) {
    setChatNoteId(note.id);
    setChatMessages([]);
    setSelectedNoteId(null);
  }

  function renderSwipeNote(note: Note, compact = false) {
    const swipeX = swipe?.id === note.id ? swipe.x : 0;
    return (
      <div
        className={`${styles.swipeRow} ${compact ? styles.compactSwipeRow : ""}`}
        key={note.id}
      >
        <div className={styles.swipeHint} aria-hidden="true">
          <AutoAwesomeRoundedIcon />
          <span>Prompt</span>
        </div>
        <button
          className={`${styles.noteCard} ${compact ? styles.compactNoteCard : ""}`}
          onClick={() => {
            if (!suppressClickRef.current) setSelectedNoteId(note.id);
          }}
          onPointerCancel={() => endSwipe(note)}
          onPointerDown={(event) => beginSwipe(event, note)}
          onPointerMove={(event) => moveSwipe(event, note)}
          onPointerUp={() => endSwipe(note)}
          style={{ transform: `translateX(${swipeX}px)` }}
          type="button"
        >
          <div className={styles.noteCardTop}>
            <span>{note.context}</span>
            <span>{note.time}</span>
          </div>
          <h2>{note.title}</h2>
          <p>{note.excerpt}</p>
          {note.image && !compact ? <ImagePlaceholder /> : null}
          <div className={styles.noteCardFooter}>
            <span>{compact ? "Open note" : "Swipe right to prompt"}</span>
            <ChevronRightRoundedIcon />
          </div>
        </button>
      </div>
    );
  }

  function renderNotesHome() {
    return (
      <>
        <header className={styles.largeHeader}>
          <div>
            <p className={styles.eyebrow}>Sushicode</p>
            <h1>Notes</h1>
          </div>
          <IconButton label="Create note" onClick={createNote}>
            <AddRoundedIcon />
          </IconButton>
        </header>

        <nav className={styles.temporalNav} aria-label="Note time range">
          {filters.map((filter) => (
            <button
              aria-pressed={temporalFilter === filter.id}
              className={temporalFilter === filter.id ? styles.activeFilter : ""}
              key={filter.id}
              onClick={() => setTemporalFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </nav>

        {temporalFilter === "overview" ? (
          <div className={styles.notesOverview}>
            <section className={styles.thinkingSummary}>
              <div>
                <span>Today</span>
                <strong>2 new thoughts</strong>
              </div>
              <div>
                <span>Ready to shape</span>
                <strong>2 notes</strong>
              </div>
              <div>
                <span>Needs decision</span>
                <strong>1 item</strong>
              </div>
            </section>

            <section className={styles.overviewSection}>
              <div className={styles.overviewHeading}>
                <div>
                  <span>Continue thinking</span>
                  <h2>Most relevant now</h2>
                </div>
                <AccessTimeRoundedIcon />
              </div>
              {renderSwipeNote(notes[0])}
            </section>

            <section className={styles.shapePrompt}>
              <div className={styles.shapePromptIcon}>
                <AutoAwesomeRoundedIcon />
              </div>
              <div>
                <span>Ready to shape</span>
                <strong>{notes[2].title}</strong>
                <p>Convert this thought while its original context is still fresh.</p>
              </div>
              <button onClick={() => openNoteInChat(notes[2])} type="button">
                Prompt
              </button>
            </section>

            <section className={styles.overviewSection}>
              <div className={styles.overviewHeading}>
                <div>
                  <span>Recent context</span>
                  <h2>Keep close</h2>
                </div>
                <button onClick={() => setTemporalFilter("month")} type="button">
                  View all
                </button>
              </div>
              <div className={styles.compactNotes}>
                {notes.slice(1, 4).map((note) => renderSwipeNote(note, true))}
              </div>
            </section>
          </div>
        ) : (
          <>
            <div className={styles.listMeta}>
              <span>{visibleNotes.length} notes</span>
              <span>
                <AccessTimeRoundedIcon /> Latest context first
              </span>
            </div>
            <div className={styles.noteList}>
              {visibleNotes.map((note) => renderSwipeNote(note))}
            </div>
          </>
        )}
      </>
    );
  }

  function renderNoteDetail(note: Note) {
    return (
      <>
        <header className={styles.compactHeader}>
          <IconButton label="Back to notes" onClick={() => setSelectedNoteId(null)}>
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <span>Note</span>
          <IconButton label="More note options">
            <MoreHorizRoundedIcon />
          </IconButton>
        </header>
        <div className={styles.noteDetailScroll}>
          <div className={styles.detailContext}>
            <span>{note.context}</span>
            <span>Edited {note.time}</span>
          </div>
          <div className={styles.noteDetailActions}>
            <button onClick={() => openNoteInChat(note)} type="button">
              <AutoAwesomeRoundedIcon />
              Use in prompt
            </button>
            <button type="button">
              <AttachFileRoundedIcon />
              Add context
            </button>
          </div>
          <article className={styles.notePaper}>
            <div className={styles.paperBinding} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div
              className={styles.noteEditor}
              contentEditable
              suppressContentEditableWarning
            >
              <h1>{note.title}</h1>
              {note.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {note.image ? <ImagePlaceholder /> : null}
            </div>
            <footer className={styles.notePaperFooter}>
              <span>{note.body.join(" ").split(" ").length} words</span>
              <span>Auto-saved</span>
            </footer>
          </article>
        </div>
        <div className={styles.editorToolbar} aria-label="Rich text formatting">
          <IconButton
            className={activeFormat === "bold" ? styles.activeTool : ""}
            label="Bold"
            onClick={() => setActiveFormat(activeFormat === "bold" ? null : "bold")}
          >
            <FormatBoldRoundedIcon />
          </IconButton>
          <IconButton
            className={activeFormat === "italic" ? styles.activeTool : ""}
            label="Italic"
            onClick={() => setActiveFormat(activeFormat === "italic" ? null : "italic")}
          >
            <FormatItalicRoundedIcon />
          </IconButton>
          <IconButton
            className={activeFormat === "list" ? styles.activeTool : ""}
            label="Bulleted list"
            onClick={() => setActiveFormat(activeFormat === "list" ? null : "list")}
          >
            <FormatListBulletedRoundedIcon />
          </IconButton>
          <span className={styles.toolbarDivider} />
          <IconButton label="Attach file">
            <AttachFileRoundedIcon />
          </IconButton>
          <IconButton label="Insert image">
            <ImageOutlinedIcon />
          </IconButton>
          <span className={styles.savedState}>
            <CheckRoundedIcon /> Saved
          </span>
        </div>
      </>
    );
  }

  function renderChat(note: Note) {
    return (
      <>
        <header className={styles.compactHeader}>
          <IconButton label="Back to notes" onClick={() => setChatNoteId(null)}>
            <CloseRoundedIcon />
          </IconButton>
          <span>Ask Sushicode</span>
          <span className={styles.agentOnline} aria-label="Agent online" />
        </header>
        <div className={styles.chatBody}>
          <div className={styles.assistantBubble}>
            <span className={styles.assistantIcon}>
              <AutoAwesomeRoundedIcon />
            </span>
            <div>
              <strong>Note attached.</strong>
              <p>
                Tell me what this should become. I can shape it into a plan, task,
                document, code change, or project decision.
              </p>
            </div>
          </div>
          {chatMessages.map((message, index) => (
            <div className={styles.humanBubble} key={`${message}-${index}`}>
              {message}
            </div>
          ))}
        </div>
        <div className={styles.chatDock}>
          <div className={styles.attachedNote}>
            <ArticleRoundedIcon />
            <div>
              <span>Attached note</span>
              <strong>{note.title}</strong>
            </div>
            <CloseRoundedIcon />
          </div>
          <div className={styles.suggestions}>
            {["Turn into tasks", "Write a spec", "Challenge this idea"].map((item) => (
              <button key={item} onClick={() => setChatInput(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <div className={styles.chatComposer}>
            <textarea
              aria-label="Message Sushicode"
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="What should happen next?"
              rows={2}
              value={chatInput}
            />
            <div>
              <IconButton label="Voice input">
                <MicNoneRoundedIcon />
              </IconButton>
              <IconButton
                className={styles.sendButton}
                label="Send message"
                onClick={sendChatMessage}
              >
                <SendRoundedIcon />
              </IconButton>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderProgressHome() {
    return (
      <>
        <header className={styles.largeHeader}>
          <div>
            <p className={styles.eyebrow}>Sushicode delivery</p>
            <h1>Work</h1>
          </div>
          <div className={styles.liveBadge}>
            <span />
            3 active
          </div>
        </header>

        <div className={styles.taskHomeScroll}>
          <section className={styles.deliveryOverview}>
            <div className={styles.deliveryHeader}>
              <div>
                <span>Delivery pulse</span>
                <strong>On track</strong>
              </div>
              <b>61%</b>
            </div>
            <ProgressBar value={61} />
            <div className={styles.deliveryFacts}>
              <div>
                <strong>3</strong>
                <span>Building</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Need input</span>
              </div>
              <div>
                <strong>Jul 11</strong>
                <span>Next ship</span>
              </div>
            </div>
          </section>

          <button
            className={styles.attentionItem}
            onClick={() => setSelectedTaskId("project-memory")}
            type="button"
          >
            <span className={styles.attentionIcon}>!</span>
            <div>
              <strong>Retention rules need your decision</strong>
              <span>MEM-86 · Blocking context backfill</span>
            </div>
            <ChevronRightRoundedIcon />
          </button>

          <div className={styles.workQueueHeading}>
            <div>
              <span>Execution queue</span>
              <h2>Work items</h2>
            </div>
            <div className={styles.queueFilters}>
              <button className={styles.activeQueueFilter} type="button">All</button>
              <button type="button">Active</button>
              <button type="button">Review</button>
            </div>
          </div>

          <div className={styles.taskList}>
            {projectTasks.map((task) => (
              <button
                className={styles.taskCard}
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                type="button"
              >
                <div className={styles.taskCardTop}>
                  <span className={styles.issueKey}>{task.key}</span>
                  <span className={styles.priority}>{task.priority}</span>
                  <span className={styles.lane}>{task.lane}</span>
                  <ChevronRightRoundedIcon />
                </div>
                <h2>{task.title}</h2>
                <p>{task.summary}</p>
                <div className={styles.devMeta}>
                  <span><HubOutlinedIcon /> {task.branch}</span>
                  <span><AccessTimeRoundedIcon /> {task.ship}</span>
                </div>
                <div className={styles.progressLabel}>
                  <span>{task.updated}</span>
                  <strong>{task.progress}%</strong>
                </div>
                <ProgressBar value={task.progress} />
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  function renderTaskDetail(task: ProjectTask) {
    return (
      <>
        <header className={styles.compactHeader}>
          <IconButton label="Back to progress" onClick={() => setSelectedTaskId(null)}>
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <span>{task.key}</span>
          <IconButton label="More task options">
            <MoreHorizRoundedIcon />
          </IconButton>
        </header>
        <div className={styles.taskDetailScroll}>
          <section className={styles.taskHero}>
            <div className={styles.taskDetailFlags}>
              <span>{task.lane}</span>
              <span>{task.priority}</span>
              <span>{task.updated}</span>
            </div>
            <h1>{task.title}</h1>
            <p>{task.summary}</p>
            <div className={styles.heroProgress}>
              <ProgressBar value={task.progress} />
              <strong>{task.progress}%</strong>
            </div>
            <div className={styles.taskQuickActions}>
              <button type="button">
                <HubOutlinedIcon /> Open branch
              </button>
              <button type="button">
                <AutoAwesomeRoundedIcon /> Add context
              </button>
            </div>
          </section>

          <section className={styles.contextGrid}>
            <div className={styles.fullContext}>
              <LightbulbOutlinedIcon />
              <span>Definition of done</span>
              <p>{task.scope}</p>
            </div>
            <div>
              <AccessTimeRoundedIcon />
              <span>Est. ship</span>
              <strong>{task.ship}</strong>
            </div>
            <div>
              <HubOutlinedIcon />
              <span>Branch</span>
              <strong>{task.branch}</strong>
            </div>
          </section>

          <section className={styles.detailSection}>
            <div className={styles.sectionHeading}>
              <h2>Tech stack</h2>
              <StorageOutlinedIcon />
            </div>
            <div className={styles.stackList}>
              {task.stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>

          <section className={styles.detailSection}>
            <div className={styles.sectionHeading}>
              <h2>Subtasks</h2>
              <span>
                {task.subtasks.filter((subtask) => subtask.status === "done").length}/
                {task.subtasks.length} done
              </span>
            </div>
            <div className={styles.subtaskList}>
              {task.subtasks.map((subtask) => (
                <div className={styles.subtask} key={subtask.title}>
                  {subtask.status === "done" ? (
                    <TaskAltRoundedIcon />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon />
                  )}
                  <div>
                    <strong>{subtask.title}</strong>
                    <span>{subtask.owner}</span>
                    <ProgressBar value={subtask.progress} />
                  </div>
                  <b>{subtask.progress}%</b>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.agentNote}>
            <div>
              <AutoAwesomeRoundedIcon />
              <span>Agent note · now</span>
            </div>
            <p>{task.agentNote}</p>
            <button type="button">Reply with context</button>
          </section>
        </div>
      </>
    );
  }

  const screenKey = chatNote
    ? `chat-${chatNote.id}`
    : selectedNote
      ? `note-${selectedNote.id}`
      : selectedTask
        ? `task-${selectedTask.id}`
        : activeTab;

  return (
    <div className={styles.stage}>
      <div className={styles.phone}>
        <StatusBar />
        <div
          className={`${styles.screen} ${
            activeTab === "progress" ? styles.screenProgress : styles.screenNotes
          }`}
          key={screenKey}
        >
          {activeTab === "notes"
            ? chatNote
              ? renderChat(chatNote)
              : selectedNote
                ? renderNoteDetail(selectedNote)
                : renderNotesHome()
            : selectedTask
              ? renderTaskDetail(selectedTask)
              : renderProgressHome()}
        </div>

        {!chatNote ? (
          <nav className={styles.tabBar} aria-label="Primary navigation">
            <span
              aria-hidden="true"
              className={`${styles.tabIndicator} ${
                activeTab === "progress" ? styles.tabIndicatorProgress : ""
              }`}
            />
            <button
              aria-label="Notes"
              aria-pressed={activeTab === "notes"}
              onClick={() => resetToTab("notes")}
              type="button"
            >
              <NotesRoundedIcon />
            </button>
            <button
              aria-label="Progress tracker"
              aria-pressed={activeTab === "progress"}
              onClick={() => resetToTab("progress")}
              type="button"
            >
              <DonutLargeRoundedIcon />
            </button>
          </nav>
        ) : null}
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
      <div className={styles.prototypeHint}>
        <span>Interactive iOS wireframe</span>
        <p>Swipe a note right to attach it to Sushicode.</p>
      </div>
    </div>
  );
}
