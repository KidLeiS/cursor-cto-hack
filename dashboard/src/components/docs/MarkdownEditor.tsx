"use client";

import dynamic from "next/dynamic";

const InitializedMarkdownEditor = dynamic(
  () => import("./InitializedMarkdownEditor"),
  {
    ssr: false,
    loading: () => <p className="docs-editor-loading">Loading editor…</p>,
  },
);

export function MarkdownEditor({
  nodeId,
  markdown,
  onChange,
}: {
  nodeId: string;
  markdown: string;
  onChange: (markdown: string) => void;
}) {
  return (
    <InitializedMarkdownEditor
      key={nodeId}
      nodeId={nodeId}
      markdown={markdown}
      onChange={onChange}
    />
  );
}
