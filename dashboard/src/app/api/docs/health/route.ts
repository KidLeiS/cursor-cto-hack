import { apiJson, apiOptions } from "@/lib/documentation-api";
import { getSupabase } from "@/lib/data";
import { requireApiUser } from "@/lib/auth";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const project = await loadDocumentationProject();
  if (!project) {
    return apiJson({
      ok: false,
      status: "not_configured",
      component: "documentation",
    }, 503);
  }

  const supabase = getSupabase()!;
  const { count, error } = await supabase
    .from("documentation_nodes")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if (error) {
    return apiJson({ ok: false, status: "database_error", component: "documentation" }, 503);
  }
  return apiJson({
    ok: true,
    status: "ready",
    component: "documentation",
    project: project.slug,
    node_count: count ?? 0,
    checked_at: new Date().toISOString(),
  });
}
