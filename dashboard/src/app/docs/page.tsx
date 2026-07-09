import type { Metadata } from "next";
import { DocumentationWorkspace } from "@/components/docs/DocumentationWorkspace";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documentation canvas · sushicode",
  description: "Explore and edit the product documentation tree.",
};

export default async function DocumentationPage() {
  const project = await loadDocumentationProject();
  if (!project) {
    return (
      <main className="docs-configuration-error">
        <span className="docs-eyebrow">Documentation</span>
        <h1>Connect Supabase to open the canvas.</h1>
        <p>Set SB_URL and SB_PK in the deployment environment.</p>
      </main>
    );
  }

  const documents = await loadDocumentationNodes(project.id);
  return (
    <DocumentationWorkspace
      projectName={project.name}
      initialDocuments={documents}
    />
  );
}
