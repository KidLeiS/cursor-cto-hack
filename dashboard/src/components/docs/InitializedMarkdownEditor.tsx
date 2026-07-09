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

type Props = MDXEditorProps & { nodeId: string };

const InitializedMarkdownEditor = forwardRef<MDXEditorMethods, Props>(
  function InitializedMarkdownEditor({ nodeId, ...props }, ref) {
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
      return result.data.url as string;
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
