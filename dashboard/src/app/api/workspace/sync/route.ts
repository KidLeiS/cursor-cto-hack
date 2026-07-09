import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/data";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";
import { loadRoadmapBundle } from "@/lib/roadmap";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const supabase = getSupabase();
  const project = await loadDocumentationProject();
  if (!supabase || !project) {
    return NextResponse.json(
      { ok: false, error: "Workspace sync is not configured." },
      { status: 503, headers },
    );
  }

  const [documentVersions, roadmapVersions, dependencyVersions] =
    await Promise.all([
      supabase
        .from("documentation_nodes")
        .select("id,lock_version,updated_at")
        .eq("project_id", project.id)
        .order("id"),
      supabase
        .from("roadmap_tasks")
        .select("id,lock_version,updated_at")
        .eq("project_id", project.id)
        .order("id"),
      supabase
        .from("roadmap_task_dependencies")
        .select("id,task_id,depends_on_task_id")
        .eq("project_id", project.id)
        .order("id"),
    ]);

  const error =
    documentVersions.error || roadmapVersions.error || dependencyVersions.error;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers },
    );
  }

  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        documentVersions.data,
        roadmapVersions.data,
        dependencyVersions.data,
      ]),
    )
    .digest("base64url");
  const etag = `"${digest}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ...headers, ETag: etag } });
  }

  const [documents, roadmap] = await Promise.all([
    loadDocumentationNodes(project.id),
    loadRoadmapBundle(),
  ]);
  return NextResponse.json(
    {
      ok: true,
      documents,
      roadmap: {
        tasks: roadmap.tasks,
        dependencies: roadmap.dependencies,
      },
      synced_at: new Date().toISOString(),
    },
    { headers: { ...headers, ETag: etag } },
  );
}
