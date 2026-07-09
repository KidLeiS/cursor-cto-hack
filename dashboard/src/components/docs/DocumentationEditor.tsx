"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  DocumentationNode,
  DocumentationRevision,
} from "../../../../shared/types";
import { resolveDocumentationAssetUrls } from "@/lib/documentation-markdown";
import { MarkdownEditor } from "./MarkdownEditor";

export type DocumentDraft = Pick<DocumentationNode, "slug" | "title" | "markdown">;

export function DocumentationEditor({
  document,
  documents,
  busy,
  message,
  onSave,
  onDelete,
  onParentChange,
  onRestore,
}: {
  document: DocumentationNode | null;
  documents: DocumentationNode[];
  busy: boolean;
  message: { kind: "ok" | "error"; text: string } | null;
  onSave: (draft: DocumentDraft) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onParentChange: (parentId: string | null) => Promise<void>;
  onRestore: (version: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [revisions, setRevisions] = useState<DocumentationRevision[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setEditing(false);
    setSourceMode(false);
    setTitle(document?.title ?? "");
    setSlug(document?.slug ?? "");
    setMarkdown(document?.markdown ?? "");
    setRevisions([]);

    if (document) {
      fetch(`/api/docs/${document.id}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((result) => {
          if (result.ok && !controller.signal.aborted) setRevisions(result.revisions);
        })
        .catch(() => {
          // History is supplementary; editing remains available if it cannot load.
        });
    }
    return () => controller.abort();
  }, [document?.id, document?.content_version]);

  const blockedParentIds = useMemo(() => {
    if (!document) return new Set<string>();
    const blocked = new Set([document.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of documents) {
        if (candidate.parent_id && blocked.has(candidate.parent_id) && !blocked.has(candidate.id)) {
          blocked.add(candidate.id);
          changed = true;
        }
      }
    }
    return blocked;
  }, [document, documents]);

  if (!document) {
    return (
      <aside className="docs-inspector docs-inspector-empty">
        <p>Select a document on the canvas.</p>
      </aside>
    );
  }

  async function save() {
    const saved = await onSave({ title, slug, markdown });
    if (saved) setEditing(false);
  }

  function cancel() {
    setTitle(document!.title);
    setSlug(document!.slug);
    setMarkdown(document!.markdown);
    setSourceMode(false);
    setEditing(false);
  }

  return (
    <aside className="docs-inspector">
      <header className="docs-inspector-header">
        <div>
          <span className="docs-eyebrow">
            {document.parent_id ? "document" : "root map"} · v{document.content_version}
          </span>
          {!editing ? <h2>{document.title}</h2> : null}
        </div>
        <div className="docs-actions">
          {editing ? (
            <>
              <button className="button-quiet" onClick={() => setSourceMode(!sourceMode)}>
                {sourceMode ? "Visual" : "Markdown"}
              </button>
              <button className="button-quiet" onClick={cancel}>
                Cancel
              </button>
              <button onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </header>

      {message ? (
        <p
          className={`docs-message ${message.kind}`}
          role={message.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}

      {editing ? (
        <div className="docs-edit-fields">
          <label>
            Title
            <input
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="docs-field-row">
            <label>
              Slug
              <input value={slug} onChange={(event) => setSlug(event.target.value)} />
            </label>
            <label>
              Parent
              <select
                value={document.parent_id ?? ""}
                onChange={(event) => onParentChange(event.target.value || null)}
                disabled={busy}
              >
                <option value="">Top level</option>
                {documents
                  .filter((candidate) => !blockedParentIds.has(candidate.id))
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="docs-editor-surface">
            {sourceMode ? (
              <textarea
                className="docs-source-editor"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                spellCheck={false}
              />
            ) : (
              <MarkdownEditor nodeId={document.id} markdown={markdown} onChange={setMarkdown} />
            )}
          </div>
          <p className="docs-editor-hint">
            Paste or drag GIF, JPEG, PNG, and WebP images directly into the visual editor.
          </p>
        </div>
      ) : (
        <div
          className="docs-preview"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            if (!(event.target as HTMLElement).closest("a")) setEditing(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") setEditing(true);
          }}
          aria-label={`Edit ${document.title}`}
        >
          <div className="docs-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {resolveDocumentationAssetUrls(document.markdown)}
            </ReactMarkdown>
          </div>
          <span className="docs-preview-hint">Click to edit</span>
        </div>
      )}

      <footer className="docs-inspector-footer">
        <details>
          <summary>History ({revisions.length})</summary>
          <div className="docs-history">
            {revisions.length === 0 ? <p>No previous versions.</p> : null}
            {revisions.map((revision) => (
              <button
                key={revision.id}
                className="docs-history-item"
                disabled={busy}
                onClick={() => onRestore(revision.content_version)}
              >
                <span>Version {revision.content_version}</span>
                <time>{new Date(revision.created_at).toLocaleString()}</time>
              </button>
            ))}
          </div>
        </details>
        <button
          className="button-danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete “${document.title}”? Documents with children cannot be deleted.`)) {
              void onDelete();
            }
          }}
        >
          Delete
        </button>
      </footer>
    </aside>
  );
}
