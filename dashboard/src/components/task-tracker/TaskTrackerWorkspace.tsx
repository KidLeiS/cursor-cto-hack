"use client";

import { FormEvent, useMemo, useState } from "react";
import type { TaskTrackerItem } from "@shared/types";
import {
  formatTaskTrackerDate,
  groupTaskTrackerItems,
} from "@/lib/task-tracker-calendar";

type Message = {
  kind: "ok" | "error";
  text: string;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; data?: TaskTrackerItem };

async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
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
    return {
      ok: false,
      error: "The task tracker could not be reached. Try again.",
    };
  }
}

function localIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEstimate(minutes: number | null): string {
  if (minutes === null) return "Unestimated";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function actionLabel(item: TaskTrackerItem, active: boolean): string {
  if (active || item.status === "actioning") return "Updating docs…";
  if (item.status === "actioned") return "Added to roadmap";
  if (item.status === "failed") return "Retry action";
  return "Action task";
}

export function TaskTrackerWorkspace({
  projectName,
  source,
  initialItems,
}: {
  projectName: string;
  source: "supabase" | "demo";
  initialItems: TaskTrackerItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const today = localIsoDate();
  const groups = useMemo(() => groupTaskTrackerItems(items), [items]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  function replaceItem(item: TaskTrackerItem) {
    setItems((current) =>
      current.map((candidate) => (candidate.id === item.id ? item : candidate)),
    );
  }

  async function addTasks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (input.trim().length < 3) {
      setMessage({ kind: "error", text: "Describe at least one task." });
      return;
    }
    setParsing(true);
    setMessage(null);
    const result = await requestJson<TaskTrackerItem[]>("/api/task-tracker", {
      method: "POST",
      body: JSON.stringify({
        input: input.trim(),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    });
    setParsing(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setItems((current) => [...current, ...result.data]);
    setSelectedId(result.data[0]?.id ?? selectedId);
    setInput("");
    setMessage({
      kind: "ok",
      text: `${result.data.length} ${result.data.length === 1 ? "task" : "tasks"} added to the calendar.`,
    });
  }

  async function actionTask(item: TaskTrackerItem) {
    setActioningId(item.id);
    setMessage(null);
    const result = await requestJson<{
      item: TaskTrackerItem;
    }>(`/api/task-tracker/${item.id}/action`, {
      method: "POST",
      body: JSON.stringify({ expected_lock_version: item.lock_version }),
    });
    setActioningId(null);
    if (!result.ok) {
      if (result.data) replaceItem(result.data);
      setMessage({ kind: "error", text: result.error });
      return;
    }
    replaceItem(result.data.item);
    setMessage({
      kind: "ok",
      text: "Documentation updated. The task is ready on the roadmap.",
    });
  }

  return (
    <div className="tracker-workspace">
      <header className="tracker-topbar">
        <div>
          <a href="/" className="docs-wordmark">sushicode</a>
          <span className="docs-project">{projectName} / task tracker</span>
        </div>
        <nav className="tracker-nav" aria-label="Product workspaces">
          <a className="button-quiet" href="/docs">Docs</a>
          <a className="button-quiet" href="/tasks">Roadmap</a>
          <span className="pill">{source} data</span>
        </nav>
      </header>

      <form className="tracker-capture" onSubmit={addTasks}>
        <div className="tracker-capture-copy">
          <span className="docs-eyebrow">Add work</span>
          <p>
            Describe a deliverable, deadline, or client request. DeepSeek will
            split and schedule the tasks.
          </p>
        </div>
        <div className="tracker-input-row">
          <label className="sr-only" htmlFor="task-tracker-input">
            Describe tasks
          </label>
          <textarea
            id="task-tracker-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Prepare the launch brief by Friday, confirm analytics owners tomorrow, and send the client update next Monday."
            disabled={parsing}
            rows={2}
          />
          <button type="submit" disabled={parsing || input.trim().length < 3}>
            {parsing ? "Planning…" : "Add tasks"}
          </button>
        </div>
        {message ? (
          <p className={`tracker-message ${message.kind}`} role="status">
            {message.text}
          </p>
        ) : null}
      </form>

      <div className="tracker-body">
        <aside className="tracker-calendar" aria-label="Task calendar">
          <div className="tracker-calendar-header">
            <div>
              <span className="docs-eyebrow">Calendar</span>
              <strong>{items.length} open items</strong>
            </div>
            <span className="mono">{today}</span>
          </div>
          <div className="tracker-calendar-list">
            {groups.length ? groups.map((group) => (
              <section className="tracker-day" key={group.date}>
                <header>
                  <h2>{formatTaskTrackerDate(group.date, today)}</h2>
                  <time dateTime={group.date}>{group.date}</time>
                </header>
                <div className="tracker-day-items">
                  {group.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`tracker-item ${selectedId === item.id ? "active" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                      aria-pressed={selectedId === item.id}
                    >
                      <span className={`priority-dot ${item.priority}`} aria-hidden="true" />
                      <span className="tracker-item-copy">
                        <strong>{item.title}</strong>
                        <span>
                          {item.priority} · {formatEstimate(item.estimate_minutes)}
                        </span>
                      </span>
                      <span
                        className={`tracker-status ${item.status}`}
                        aria-label={`Status: ${item.status}`}
                      >
                        {item.status === "actioned" ? "✓" : "→"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )) : (
              <div className="tracker-empty">
                <strong>No tasks yet</strong>
                <p>Describe the next client deliverable above.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="tracker-detail">
          {selected ? (
            <>
              <header className="tracker-detail-header">
                <div>
                  <div className="tracker-detail-meta">
                    <span className={`priority-badge ${selected.priority}`}>
                      {selected.priority} priority
                    </span>
                    <span className={`pill ${selected.status}`}>
                      {selected.status}
                    </span>
                  </div>
                  <h1>{selected.title}</h1>
                  <p>{selected.description}</p>
                </div>
                <button
                  type="button"
                  disabled={
                    actioningId !== null ||
                    selected.status === "actioned" ||
                    selected.status === "cancelled"
                  }
                  onClick={() => actionTask(selected)}
                >
                  {actionLabel(selected, actioningId === selected.id)}
                </button>
              </header>

              <div className="tracker-facts">
                <div>
                  <span>Scheduled</span>
                  <strong>{formatTaskTrackerDate(selected.scheduled_for, today)}</strong>
                  <time dateTime={selected.scheduled_for}>{selected.scheduled_for}</time>
                </div>
                <div>
                  <span>Deadline</span>
                  <strong>
                    {selected.due_on
                      ? formatTaskTrackerDate(selected.due_on, today)
                      : "Flexible"}
                  </strong>
                  {selected.due_on ? (
                    <time dateTime={selected.due_on}>{selected.due_on}</time>
                  ) : null}
                </div>
                <div>
                  <span>Effort</span>
                  <strong>{formatEstimate(selected.estimate_minutes)}</strong>
                </div>
              </div>

              <section className="tracker-impact">
                <span className="docs-eyebrow">When actioned</span>
                <h2>Documentation update</h2>
                <p className="tracker-markdown-preview">
                  {selected.documentation_update}
                </p>
                <h2>Roadmap outcome</h2>
                <p>{selected.roadmap_description}</p>
                {selected.status === "actioned" ? (
                  <div className="actions">
                    <a className="button-quiet" href="/docs">View documentation</a>
                    <a className="button-quiet" href="/tasks">View roadmap</a>
                  </div>
                ) : null}
                {selected.action_error ? (
                  <p className="tracker-message error">
                    Last action: {selected.action_error}
                  </p>
                ) : null}
              </section>
            </>
          ) : (
            <div className="tracker-empty tracker-detail-empty">
              <strong>Select a task</strong>
              <p>Task context and action controls will appear here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
