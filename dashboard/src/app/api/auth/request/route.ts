import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicAuthClient } from "@/lib/auth";
import { ALLOWED_EMAIL } from "@/lib/auth-constants";
import { getSupabase } from "@/lib/data";

const requestSchema = z.object({
  email: z.string().trim().email().max(320),
});

function digest(value: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });
  }
  const email = parsed.data.email.toLowerCase();
  const pepper = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!pepper) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = digest(forwarded || "unknown", pepper);
  const emailHash = digest(email, pepper);
  const service = getSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await service
    .from("auth_request_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .or(`email_hash.eq.${emailHash},ip_hash.eq.${ipHash}`);
  await service
    .from("auth_request_attempts")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }
  await service.from("auth_request_attempts").insert({
    email_hash: emailHash,
    ip_hash: ipHash,
  });

  if (email !== ALLOWED_EMAIL) {
    const { error } = await service.from("waitlist_entries").upsert(
      { email, status: "pending", source: "login" },
      { onConflict: "email", ignoreDuplicates: true },
    );
    if (error) {
      return NextResponse.json({ error: "Unable to join the waitlist." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      waitlisted: true,
      message: "You are on the waitlist.",
    });
  }

  const auth = createPublicAuthClient();
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const { error } = await auth.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl.replace(/\/$/, "")}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return NextResponse.json({ error: "Unable to send the sign-in link." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    waitlisted: false,
    message: "Check your email for a secure sign-in link.",
  });
}
