import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ALLOWED_EMAIL } from "@/lib/auth";

const publicPaths = new Set([
  "/login",
  "/auth/callback",
  "/api/auth/request",
  "/api/health",
  "/api/mcp",
]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    publicPaths.has(path) ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const url = process.env.SB_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SB_PK || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = user?.email?.toLowerCase() === ALLOWED_EMAIL;
  if (allowed) return response;

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
  if (user) loginUrl.searchParams.set("denied", "1");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
