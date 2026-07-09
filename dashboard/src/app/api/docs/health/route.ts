import { apiJson, apiOptions } from "@/lib/documentation-api";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET() {
  const project = await loadDocumentationProject();
  if (!project) {
    return apiJson({
      ok: false,
      status: "not_configured",
      component: "documentation",
    }, 503);
  }

  const nodes = await loadDocumentationNodes(project.id);
  return apiJson({
    ok: true,
    status: "ready",
    component: "documentation",
    project: project.slug,
    node_count: nodes.length,
    checked_at: new Date().toISOString(),
  });
}
