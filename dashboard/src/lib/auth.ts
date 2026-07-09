import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ALLOWED_EMAIL } from "./auth-constants";

function authEnvironment(): { url: string; anonKey: string } | null {
  const url = process.env.SB_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SB_PK || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function createPublicAuthClient() {
  const environment = authEnvironment();
  if (!environment) return null;
  return createClient(environment.url, environment.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createServerAuthClient() {
  const environment = authEnvironment();
  if (!environment) return null;
  const cookieStore = await cookies();
  return createServerClient(environment.url, environment.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them.
        }
      },
    },
  });
}

export async function getAllowedUser(): Promise<User | null> {
  const supabase = await createServerAuthClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === ALLOWED_EMAIL ? user : null;
}

export async function requireAllowedUser(): Promise<User> {
  const user = await getAllowedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireApiUser(): Promise<NextResponse | null> {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.AUTH_TEST_USER === "allowed"
  ) {
    return null;
  }
  const user = await getAllowedUser();
  return user
    ? null
    : NextResponse.json({ error: "Authentication required." }, { status: 401 });
}
