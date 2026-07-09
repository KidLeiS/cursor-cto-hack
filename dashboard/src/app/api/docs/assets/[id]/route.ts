import { deleteDocumentationImage } from "@/lib/documentation-actions";
import {
  actionStatus,
  apiJson,
  apiOptions,
  documentationIdSchema,
} from "@/lib/documentation-api";
import { loadDocumentationProject } from "@/lib/documentation-project";
import { getSupabase } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!documentationIdSchema.safeParse(id).success) {
    return apiJson({ ok: false, error: "Asset ID must be a UUID." }, 422);
  }
  const project = await loadDocumentationProject();
  const supabase = getSupabase();
  if (!project || !supabase) {
    return apiJson({ ok: false, error: "Documentation is not configured." }, 503);
  }
  const { data: asset } = await supabase
    .from("documentation_assets")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();
  if (!asset || asset.project_id !== project.id) {
    return apiJson({ ok: false, error: "Image was not found." }, 404);
  }

  const result = await deleteDocumentationImage(id);
  return apiJson(result, actionStatus(result));
}
