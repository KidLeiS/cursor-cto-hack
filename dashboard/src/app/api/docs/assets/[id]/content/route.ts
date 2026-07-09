import { NextResponse } from "next/server";
import { apiJson, apiOptions, openApiHeaders } from "@/lib/documentation-api";
import { getSupabase } from "@/lib/data";

export const dynamic = "force-dynamic";
export const OPTIONS = apiOptions;

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const supabase = getSupabase();
  if (!supabase) return apiJson({ ok: false, error: "Documentation is not configured." }, 503);

  const { data: asset, error } = await supabase
    .from("documentation_assets")
    .select("storage_bucket,storage_path,mime_type")
    .eq("id", id)
    .maybeSingle();
  if (error) return apiJson({ ok: false, error: error.message }, 400);
  if (!asset) return apiJson({ ok: false, error: "Image was not found." }, 404);

  const { data, error: signError } = await supabase.storage
    .from(asset.storage_bucket as string)
    .createSignedUrl(asset.storage_path as string, 60 * 10);
  if (signError) return apiJson({ ok: false, error: signError.message }, 400);

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      ...openApiHeaders,
      "Cache-Control": "private, max-age=300",
    },
  });
}
