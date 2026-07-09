import {
  deleteDocumentationNode,
  moveDocumentationNode,
  restoreDocumentationRevision,
  updateDocumentationContent,
} from "@/lib/documentation-actions";
import {
  actionStatus,
  apiJson,
  apiOptions,
  documentationIdSchema,
  readJson,
  updateNodeSchema,
} from "@/lib/documentation-api";
import {
  loadDocumentationAssets,
  loadDocumentationNodes,
  loadDocumentationRevisions,
} from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!documentationIdSchema.safeParse(id).success) {
    return apiJson({ ok: false, error: "Document ID must be a UUID." }, 422);
  }
  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);

  const nodes = await loadDocumentationNodes(project.id);
  const node = nodes.find((item) => item.id === id);
  if (!node) return apiJson({ ok: false, error: "Document was not found." }, 404);

  const [revisions, assets] = await Promise.all([
    loadDocumentationRevisions(id),
    loadDocumentationAssets(id),
  ]);
  return apiJson({ ok: true, node, revisions, assets });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  if (!documentationIdSchema.safeParse(id).success) {
    return apiJson({ ok: false, error: "Document ID must be a UUID." }, 422);
  }
  const parsed = await readJson(request, updateNodeSchema);
  if ("response" in parsed) return parsed.response;

  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);
  const projectNodes = await loadDocumentationNodes(project.id);
  if (!projectNodes.some((node) => node.id === id)) {
    return apiJson({ ok: false, error: "Document was not found." }, 404);
  }

  const input = parsed.data;
  let result;
  if (input.operation === "content") {
    result = await updateDocumentationContent({
      id,
      expected_lock_version: input.expected_lock_version,
      slug: input.slug,
      title: input.title,
      markdown: input.markdown,
    });
  } else if (input.operation === "move") {
    result = await moveDocumentationNode({
      id,
      expected_lock_version: input.expected_lock_version,
      parent_id: input.parent_id,
      sort_order: input.sort_order,
      canvas_x: input.canvas_x,
      canvas_y: input.canvas_y,
      canvas_width: input.canvas_width,
      canvas_height: input.canvas_height,
      canvas_metadata: input.canvas_metadata,
    });
  } else {
    result = await restoreDocumentationRevision({
      node_id: id,
      content_version: input.content_version,
      expected_lock_version: input.expected_lock_version,
    });
  }

  return apiJson(result, actionStatus(result));
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  if (!documentationIdSchema.safeParse(id).success) {
    return apiJson({ ok: false, error: "Document ID must be a UUID." }, 422);
  }
  const version = Number(new URL(request.url).searchParams.get("lock_version"));
  if (!Number.isInteger(version) || version < 1) {
    return apiJson({ ok: false, error: "A positive lock_version query parameter is required." }, 422);
  }

  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);
  const projectNodes = await loadDocumentationNodes(project.id);
  if (!projectNodes.some((node) => node.id === id)) {
    return apiJson({ ok: false, error: "Document was not found." }, 404);
  }

  const result = await deleteDocumentationNode({ id, expected_lock_version: version });
  return apiJson(result, actionStatus(result));
}
