import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { callMcpTool, mcpTools } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

const protocolVersions = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonRpc(id: JsonRpcRequest["id"], result: unknown, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status, headers: corsHeaders },
  );
}

function jsonRpcError(
  id: JsonRpcRequest["id"],
  code: number,
  message: string,
  status = 200,
) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status, headers: corsHeaders },
  );
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function authorize(request: Request): NextResponse | null {
  const configuredKey = process.env.MCP_API_KEY;
  if (!configuredKey) {
    return NextResponse.json(
      {
        error:
          "MCP_API_KEY is not configured. Add it to the Vercel project and redeploy.",
      },
      { status: 503, headers: corsHeaders },
    );
  }
  const authorization = request.headers.get("authorization");
  const suppliedKey = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!suppliedKey || !secureEqual(suppliedKey, configuredKey)) {
    return NextResponse.json(
      { error: "Provide the MCP API key as a Bearer token." },
      {
        status: 401,
        headers: { ...corsHeaders, "WWW-Authenticate": "Bearer" },
      },
    );
  }
  return null;
}

export async function POST(request: Request) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return jsonRpcError(message.id, -32600, "Invalid Request", 400);
  }

  if (message.method === "initialize") {
    const requestedVersion =
      typeof message.params?.protocolVersion === "string"
        ? message.params.protocolVersion
        : "";
    return jsonRpc(message.id, {
      protocolVersion: protocolVersions.includes(requestedVersion)
        ? requestedVersion
        : protocolVersions[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "sushicode", title: "Sushicode Workspace", version: "1.0.0" },
      instructions:
        "Read before writing. Use the returned lock_version as expected_lock_version for every edit or delete. On a conflict, read the record again before retrying.",
    });
  }

  if (message.method === "notifications/initialized") {
    return new NextResponse(null, { status: 202, headers: corsHeaders });
  }
  if (message.method === "ping") return jsonRpc(message.id, {});
  if (message.method === "tools/list") {
    return jsonRpc(message.id, { tools: mcpTools });
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (typeof name !== "string") {
      return jsonRpcError(message.id, -32602, "Tool name is required.");
    }
    try {
      const value = await callMcpTool(name, message.params?.arguments);
      return jsonRpc(message.id, {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
        isError: false,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Tool call failed.";
      return jsonRpc(message.id, {
        content: [{ type: "text", text }],
        isError: true,
      });
    }
  }

  return jsonRpcError(message.id, -32601, `Method not found: ${message.method}`);
}

export function GET() {
  return NextResponse.json(
    {
      name: "Sushicode Remote MCP",
      transport: "Streamable HTTP",
      endpoint: "/api/mcp",
      authentication: "Authorization: Bearer <MCP_API_KEY>",
      capabilities: ["documentation read/write", "roadmap read/write"],
    },
    { status: 405, headers: { ...corsHeaders, Allow: "POST, OPTIONS" } },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
