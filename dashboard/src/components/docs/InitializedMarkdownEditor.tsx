"use client";

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
  type MDXEditorProps,
} from "@mdxeditor/editor";
import { forwardRef } from "react";
import type { DocumentationAsset } from "../../../../shared/types";

type Props = MDXEditorProps & {
  nodeId: string;
  onAssetUploaded?: (asset: DocumentationAsset & { signed_url: string }) => void;
};

const InitializedMarkdownEditor = forwardRef<MDXEditorMethods, Props>(
  function InitializedMarkdownEditor({ nodeId, onAssetUploaded, ...props }, ref) {
    async function uploadImage(file: File): Promise<string> {
      const formData = new FormData();
      formData.set("node_id", nodeId);
      formData.set("alt_text", file.name);
      formData.set("file", file);

      const response = await fetch("/api/docs/assets", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Image upload failed.");
      }
      onAssetUploaded?.({
        ...result.data.asset,
        signed_url: result.data.signed_url,
      });
      return `/api/docs/assets/${result.data.asset.id}/content`;
    }

    return (
      <MDXEditor
        {...props}
        ref={ref}
        contentEditableClassName="docs-rich-editor"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "tsx" }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              "": "Plain text",
              bash: "Bash",
              css: "CSS",
              javascript: "JavaScript",
              json: "JSON",
              sql: "SQL",
              tsx: "TypeScript",
              typescript: "TypeScript",
            },
          }),
          imagePlugin({ imageUploadHandler: uploadImage }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarClassName: "docs-editor-toolbar",
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <CreateLink />
                <InsertImage />
                <InsertTable />
                <InsertCodeBlock />
              </>
            ),
          }),
        ]}
      />
    );
  },
);

export default InitializedMarkdownEditor;
