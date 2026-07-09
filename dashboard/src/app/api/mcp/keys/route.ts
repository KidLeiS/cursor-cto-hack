import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAllowedUser } from "@/lib/auth";
import { getSupabase } from "@/lib/data";
import { createMcpApiKey } from "@/lib/mcp-auth";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

async function projectId() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id as string | undefined;
}

export async function GET() {
  const user = await requireAllowedUser();
  const project = await projectId();
  const supabase = getSupabase();
  if (!project || !supabase) {
    return NextResponse.json({ error: "Project is not configured." }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("mcp_api_keys")
    .select("id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at")
    .eq("user_id", user.id)
    .eq("project_id", project)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Key name must be 1–80 characters." }, { status: 422 });
  }
  const project = await projectId();
  if (!project) {
    return NextResponse.json({ error: "Project is not configured." }, { status: 503 });
  }
  try {
    const data = await createMcpApiKey({
      userId: user.id,
      projectId: project,
      name: parsed.data.name,
    });
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create key." },
      { status: 422 },
    );
  }
}
