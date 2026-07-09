import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { POST } from "../src/app/api/mcp/route";

const originalNodeEnv = process.env.NODE_ENV;
const originalKey = process.env.MCP_TEST_API_KEY;
const key = "test-mcp-key";

function request(method: string, params: Record<string, unknown> = {}, token = key) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("remote MCP endpoint", () => {
  before(() => {
    process.env.NODE_ENV = "test";
    process.env.MCP_TEST_API_KEY = key;
  });

  after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalKey === undefined) delete process.env.MCP_TEST_API_KEY;
    else process.env.MCP_TEST_API_KEY = originalKey;
  });

  it("negotiates Streamable HTTP initialization", async () => {
    const response = await POST(
      request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.result.protocolVersion, "2025-06-18");
    assert.equal(body.result.serverInfo.name, "sushicode");
    assert.deepEqual(body.result.capabilities, { tools: { listChanged: false } });
  });

  it("publishes documentation and roadmap read/write tools", async () => {
    const response = await POST(request("tools/list"));
    const body = await response.json();
    const names = body.result.tools.map((tool: { name: string }) => tool.name);

    assert.deepEqual(names, [
      "documentation_list",
      "documentation_get",
      "documentation_create",
      "documentation_update",
      "documentation_delete",
      "roadmap_list",
      "roadmap_get",
      "roadmap_create",
      "roadmap_update",
      "roadmap_delete",
    ]);
  });

  it("rejects an invalid Bearer token", async () => {
    const response = await POST(request("tools/list", {}, "wrong-key"));
    assert.equal(response.status, 401);
  });
});
