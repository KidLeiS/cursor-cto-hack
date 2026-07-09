import { NextResponse } from "next/server";
import { ALLOWED_EMAIL, createServerAuthClient } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const destination = new URL("/", url.origin);
  if (!code) {
    destination.pathname = "/login";
    destination.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(destination);
  }

  const supabase = await createServerAuthClient();
  if (!supabase) {
    destination.pathname = "/login";
    destination.searchParams.set("error", "not_configured");
    return NextResponse.redirect(destination);
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    destination.pathname = "/login";
    destination.searchParams.set("error", "expired_link");
    return NextResponse.redirect(destination);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() !== ALLOWED_EMAIL) {
    await supabase.auth.signOut();
    destination.pathname = "/login";
    destination.searchParams.set("denied", "1");
  }
  return NextResponse.redirect(destination);
}
