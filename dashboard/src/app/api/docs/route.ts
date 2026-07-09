import {
  createDocumentationNode,
} from "@/lib/documentation-actions";
import {
  apiJson,
  apiOptions,
  createNodeSchema,
  readJson,
  actionStatus,
} from "@/lib/documentation-api";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET() {
  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);

  const nodes = await loadDocumentationNodes(project.id);
  return apiJson({
    ok: true,
    project,
    nodes,
    endpoints: {
      node: "/api/docs/{nodeId}",
      assets: "/api/docs/assets",
      health: "/api/docs/health",
    },
  });
}

export async function POST(request: Request) {
  const parsed = await readJson(request, createNodeSchema);
  if ("response" in parsed) return parsed.response;

  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);

  const existingNodes = await loadDocumentationNodes(project.id);
  if (existingNodes.length >= 250) {
    return apiJson({ ok: false, error: "The public test project is limited to 250 documents." }, 429);
  }
  if (
    parsed.data.parent_id &&
    !existingNodes.some((node) => node.id === parsed.data.parent_id)
  ) {
    return apiJson({ ok: false, error: "Parent document was not found." }, 404);
  }

  const result = await createDocumentationNode({
    ...parsed.data,
    project_id: project.id,
  });
  return apiJson(result, result.ok ? 201 : actionStatus(result));
}
