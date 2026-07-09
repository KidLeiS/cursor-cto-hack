"use client";

import { useState, useTransition } from "react";
import { updateWorkplanStep, type StepUpdate } from "@/lib/actions";
import type { WorkplanStep } from "../../../shared/types";

export function WorkplanStepEditor({ step }: { step: WorkplanStep }) {
  const [draft, setDraft] = useState<StepUpdate>({
    id: step.id,
    title: step.title,
    implementation_plan: step.implementation_plan,
    validation_requirements: step.validation_requirements,
    status: step.status,
    sort_order: step.sort_order,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateWorkplanStep(draft);
      setOk(result.ok);
      setMessage(result.ok ? "Saved — agents will re-read this step." : result.error);
    });
  }

  return (
    <div className="step-editor">
      <div className="row-title">
        <h3>
          <span className="mono">#{draft.sort_order + 1}</span> {draft.title || "Untitled step"}
        </h3>
        <span className={`pill ${draft.status}`}>{draft.status}</span>
      </div>

      <label>
        Title
        <input
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />
      </label>

      <label>
        Implementation plan
        <textarea
          value={draft.implementation_plan}
          onChange={(e) =>
            setDraft((d) => ({ ...d, implementation_plan: e.target.value }))
          }
        />
      </label>

      <label>
        Validation requirements
        <textarea
          value={draft.validation_requirements}
          onChange={(e) =>
            setDraft((d) => ({ ...d, validation_requirements: e.target.value }))
          }
        />
      </label>

      <div className="actions">
        <label style={{ minWidth: "10rem" }}>
          Status
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
          >
            {[
              "pending",
              "ready",
              "in_progress",
              "done",
              "blocked",
              "skipped",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ width: "6rem" }}>
          Order
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))
            }
          />
        </label>
        <button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save step"}
        </button>
        {message ? (
          <span className={`flash ${ok ? "ok" : "err"}`}>{message}</span>
        ) : null}
      </div>
    </div>
  );
}
