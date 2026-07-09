import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = await createServerAuthClient();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
