"use client";

import dynamic from "next/dynamic";
import type { DocumentationAsset } from "../../../../shared/types";

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
  onAssetUploaded,
}: {
  nodeId: string;
  markdown: string;
  onChange: (markdown: string) => void;
  onAssetUploaded?: (asset: DocumentationAsset & { signed_url: string }) => void;
}) {
  return (
    <InitializedMarkdownEditor
      key={nodeId}
      nodeId={nodeId}
      markdown={markdown}
      onChange={onChange}
      onAssetUploaded={onAssetUploaded}
    />
  );
}
