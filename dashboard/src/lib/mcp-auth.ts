import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getSupabase } from "./data";
import { ALLOWED_EMAIL } from "./auth";

export type McpAuthContext = {
  keyId: string;
  userId: string;
  projectId: string;
  scopes: string[];
};

const KEY_PREFIX = "sushi_mcp_";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateMcpKey(
  authorization: string | null,
): Promise<McpAuthContext | null> {
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (
    process.env.NODE_ENV === "test" &&
    process.env.MCP_TEST_API_KEY &&
    safeEqual(token, process.env.MCP_TEST_API_KEY)
  ) {
    return {
      keyId: "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000002",
      projectId: "00000000-0000-4000-8000-000000000003",
      scopes: ["mcp:read", "mcp:write"],
    };
  }
  if (!token.startsWith(KEY_PREFIX) || token.length < 40) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const keyPrefix = token.slice(0, KEY_PREFIX.length + 12);
  const { data: key } = await supabase
    .from("mcp_api_keys")
    .select("id,user_id,project_id,key_hash,scopes,expires_at,revoked_at")
    .eq("key_prefix", keyPrefix)
    .maybeSingle();
  if (
    !key ||
    key.revoked_at ||
    (key.expires_at && new Date(key.expires_at).valueOf() <= Date.now()) ||
    !safeEqual(hashKey(token), key.key_hash as string)
  ) {
    return null;
  }
  const { data: member } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("user_id", key.user_id)
    .eq("project_id", key.project_id)
    .eq("email", ALLOWED_EMAIL)
    .maybeSingle();
  if (!member) return null;

  await supabase
    .from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  return {
    keyId: key.id as string,
    userId: key.user_id as string,
    projectId: key.project_id as string,
    scopes: key.scopes as string[],
  };
}

export async function createMcpApiKey(input: {
  userId: string;
  projectId: string;
  name: string;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Database is not configured.");
  const { data: member } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("email", ALLOWED_EMAIL)
    .maybeSingle();
  if (!member) throw new Error("Project membership is required.");
  const { count } = await supabase
    .from("mcp_api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .is("revoked_at", null);
  if ((count ?? 0) >= 10) {
    throw new Error("Revoke an existing key before creating another.");
  }

  const token = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const keyPrefix = token.slice(0, KEY_PREFIX.length + 12);
  const { data, error } = await supabase
    .from("mcp_api_keys")
    .insert({
      user_id: input.userId,
      project_id: input.projectId,
      name: input.name.trim(),
      key_prefix: keyPrefix,
      key_hash: hashKey(token),
    })
    .select("id,name,key_prefix,scopes,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, key: token };
}

export async function recordMcpToolCall(
  context: McpAuthContext,
  toolName: string,
  succeeded: boolean,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("mcp_audit_events").insert({
    key_id: context.keyId,
    user_id: context.userId,
    project_id: context.projectId,
    tool_name: toolName,
    succeeded,
  });
}

export async function isMcpRateLimited(context: McpAuthContext): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("mcp_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("key_id", context.keyId)
    .gte("created_at", since);
  return (count ?? 0) >= 60;
}
