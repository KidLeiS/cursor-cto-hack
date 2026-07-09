import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, status: "not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });
  if (error) {
    return NextResponse.json(
      { ok: false, status: "database_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, status: "ready", authentication: "required", projects: count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
