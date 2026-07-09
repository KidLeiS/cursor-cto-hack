import { uploadDocumentationImage } from "@/lib/documentation-actions";
import { actionStatus, apiJson, apiOptions } from "@/lib/documentation-api";
import { documentationIdSchema } from "@/lib/documentation-api";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadDocumentationProject } from "@/lib/documentation-project";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

async function hasValidImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = new TextDecoder().decode(bytes);
  if (file.type === "image/png") {
    return bytes.slice(0, 8).every((value, index) =>
      value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  }
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/gif") {
    return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  }
  if (file.type === "image/webp") {
    return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 11 * 1024 * 1024) {
    return apiJson({ ok: false, error: "Upload is larger than 10 MB." }, 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiJson({ ok: false, error: "Expected multipart form data." }, 400);
  }

  const project = await loadDocumentationProject();
  if (!project) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);

  const nodeId = formData.get("node_id");
  const file = formData.get("file");
  const altText = formData.get("alt_text");
  if (typeof nodeId !== "string" || !documentationIdSchema.safeParse(nodeId).success) {
    return apiJson({ ok: false, error: "A valid node_id is required." }, 422);
  }
  const nodes = await loadDocumentationNodes(project.id);
  if (!nodes.some((node) => node.id === nodeId)) {
    return apiJson({ ok: false, error: "Document was not found." }, 404);
  }
  if (!(file instanceof File) || file.name.length > 255) {
    return apiJson({ ok: false, error: "A valid image filename is required." }, 422);
  }
  if (typeof altText === "string" && altText.length > 240) {
    return apiJson({ ok: false, error: "Image alt text is limited to 240 characters." }, 422);
  }
  if (!(await hasValidImageSignature(file))) {
    return apiJson({ ok: false, error: "Image contents do not match a supported format." }, 422);
  }

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
