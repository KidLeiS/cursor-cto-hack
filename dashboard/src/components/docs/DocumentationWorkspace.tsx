"use client";

import { useMemo, useState } from "react";
import type { DocumentationNode } from "../../../../shared/types";
import { DocumentationCanvas } from "./DocumentationCanvas";
import {
  DocumentationEditor,
  type DocumentDraft,
} from "./DocumentationEditor";

type ApiResult<T = DocumentationNode> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

async function apiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { "Content-Type": "application/json", ...init?.headers },
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    return {
      ok: false,
      error: result.error || `Request failed (${response.status}).`,
      code: result.code,
    };
  }
  return result;
}

function outlineRows(documents: DocumentationNode[]) {
  const byParent = new Map<string | null, DocumentationNode[]>();
  for (const document of documents) {
    const siblings = byParent.get(document.parent_id) ?? [];
    siblings.push(document);
    byParent.set(document.parent_id, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  }

  const rows: Array<{ document: DocumentationNode; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const document of byParent.get(parentId) ?? []) {
      rows.push({ document, depth });
      visit(document.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

export function DocumentationWorkspace({
  projectName,
  initialDocuments,
}: {
  projectName: string;
  initialDocuments: DocumentationNode[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocuments[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const selected = documents.find((document) => document.id === selectedId) ?? null;
  const outline = useMemo(() => outlineRows(documents), [documents]);

  function replaceDocument(document: DocumentationNode) {
    setDocuments((current) =>
      current.map((item) => (item.id === document.id ? document : item)),
    );
  }

  async function moveDocument(
    document: DocumentationNode,
    x: number,
    y: number,
    parentId = document.parent_id,
  ) {
    setBusy(true);
    setMessage(null);
    const result = await apiRequest<DocumentationNode>(`/api/docs/${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        operation: "move",
        expected_lock_version: document.lock_version,
        parent_id: parentId,
        sort_order: document.sort_order,
        canvas_x: x,
        canvas_y: y,
        canvas_width: document.canvas_width,
        canvas_height: document.canvas_height,
        canvas_metadata: document.canvas_metadata,
      }),
    });
    setBusy(false);

    if (!result.ok) {
      setResetKey((value) => value + 1);
      setMessage({ kind: "error", text: result.error });
      return;
    }
    replaceDocument(result.data);
    if (parentId !== document.parent_id) {
      setMessage({ kind: "ok", text: "Branch moved." });
    }
  }

  async function saveDocument(draft: DocumentDraft): Promise<boolean> {
    if (!selected) return false;
    setBusy(true);
    setMessage(null);
    const result = await apiRequest<DocumentationNode>(`/api/docs/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        operation: "content",
        expected_lock_version: selected.lock_version,
        ...draft,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return false;
    }
    replaceDocument(result.data);
    setMessage({ kind: "ok", text: "Document saved." });
    return true;
  }

  async function createDocument(parentId: string | null) {
    const parent = parentId
      ? documents.find((document) => document.id === parentId)
      : null;
    const childCount = documents.filter((document) => document.parent_id === parentId).length;
    setBusy(true);
    setMessage(null);
    const result = await apiRequest<DocumentationNode>("/api/docs", {
      method: "POST",
      body: JSON.stringify({
        parent_id: parentId,
        title: "Untitled document",
        slug: `untitled-${Date.now().toString(36)}`,
        markdown: "# Untitled document\n\nStart writing…",
        sort_order: childCount,
        canvas_x: parent ? parent.canvas_x + 360 : 80,
        canvas_y: parent ? parent.canvas_y + childCount * 190 : 100 + childCount * 220,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setDocuments((current) => [...current, result.data]);
    setSelectedId(result.data.id);
    setMessage({ kind: "ok", text: "Document created. Click the preview to edit." });
  }

  async function deleteSelected() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const result = await apiRequest<undefined>(
      `/api/docs/${selected.id}?lock_version=${selected.lock_version}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const remaining = documents.filter((document) => document.id !== selected.id);
    setDocuments(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  async function restoreVersion(version: number) {
    if (!selected) return;
    setBusy(true);
    const result = await apiRequest<DocumentationNode>(`/api/docs/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        operation: "restore",
        expected_lock_version: selected.lock_version,
        content_version: version,
      }),
    });
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    replaceDocument(result.data);
    setMessage({ kind: "ok", text: `Version ${version} restored as the latest version.` });
  }

  return (
    <div className="docs-workspace">
      <header className="docs-topbar">
        <div>
          <a href="/" className="docs-wordmark">sushicode</a>
          <span className="docs-project">{projectName} / docs</span>
        </div>
        <div className="docs-actions">
          <a className="button-quiet docs-api-link" href="/api/docs" target="_blank">
            API
          </a>
          <button
            className="button-quiet"
            disabled={busy}
            onClick={() => createDocument(null)}
          >
            New root
          </button>
          <button disabled={busy || !selected} onClick={() => createDocument(selectedId)}>
            New child
          </button>
        </div>
      </header>

      <div className="docs-body">
        <nav className="docs-outline" aria-label="Documentation tree">
          <span className="docs-eyebrow">Contents</span>
          <div className="docs-outline-list">
            {outline.map(({ document, depth }) => (
              <button
                key={document.id}
                className={document.id === selectedId ? "active" : ""}
                style={{ paddingLeft: `${0.75 + depth * 0.85}rem` }}
                onClick={() => setSelectedId(document.id)}
              >
                {document.title}
              </button>
            ))}
          </div>
        </nav>

        <section className="docs-canvas" aria-label="Documentation canvas">
          {documents.length ? (
            <DocumentationCanvas
              documents={documents}
              selectedId={selectedId}
              resetKey={resetKey}
              onSelect={setSelectedId}
              onMove={moveDocument}
            />
          ) : (
            <div className="docs-empty">
              <h2>No documents yet</h2>
              <p>Create a root map to begin.</p>
            </div>
          )}
        </section>

        <DocumentationEditor
          document={selected}
          documents={documents}
          busy={busy}
          message={message}
          onSave={saveDocument}
          onDelete={deleteSelected}
          onParentChange={(parentId) =>
            selected
              ? moveDocument(selected, selected.canvas_x, selected.canvas_y, parentId)
              : Promise.resolve()
          }
          onRestore={restoreVersion}
        />
      </div>
    </div>
  );
}
