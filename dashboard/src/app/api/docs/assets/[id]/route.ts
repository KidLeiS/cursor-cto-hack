import { deleteDocumentationImage } from "@/lib/documentation-actions";
import { actionStatus, apiJson, apiOptions } from "@/lib/documentation-api";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  const result = await deleteDocumentationImage(id);
  return apiJson(result, actionStatus(result));
}
