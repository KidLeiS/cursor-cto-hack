import { uploadDocumentationImage } from "@/lib/documentation-actions";
import { actionStatus, apiJson, apiOptions } from "@/lib/documentation-api";
import { loadDocumentationProject } from "@/lib/documentation-project";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiJson({ ok: false, error: "Expected multipart form data." }, 400);
  }

  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);
  formData.set("project_id", project.id);

  const result = await uploadDocumentationImage(formData);
  if (!result.ok) return apiJson(result, actionStatus(result));

  const asset = result.data!.asset;
  return apiJson({
    ...result,
    data: {
      ...result.data,
      url: `/api/docs/assets/${asset.id}/content`,
      markdown: `![${asset.alt_text ?? asset.original_filename}](/api/docs/assets/${asset.id}/content)`,
    },
  }, 201);
}
