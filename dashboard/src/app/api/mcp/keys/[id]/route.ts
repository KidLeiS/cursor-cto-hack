import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAllowedUser } from "@/lib/auth";
import { getSupabase } from "@/lib/data";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const user = await requireAllowedUser();
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid key ID." }, { status: 422 });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("mcp_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Active key not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
