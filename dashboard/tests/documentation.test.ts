import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DocumentationNode } from "../../shared/types";
import { buildDocumentationTree } from "../src/lib/documentation";
import {
  persistDocumentationAssetUrls,
  resolveDocumentationAssetUrls,
} from "../src/lib/documentation-markdown";
import { createNodeSchema, updateNodeSchema } from "../src/lib/documentation-api";

const now = "2026-07-09T00:00:00.000Z";

function node(
  id: string,
  parentId: string | null,
  sortOrder: number,
  title = id,
): DocumentationNode {
  return {
    id,
    project_id: "project",
    parent_id: parentId,
    slug: id,
    title,
    markdown: "",
    sort_order: sortOrder,
    canvas_x: 0,
    canvas_y: 0,
    canvas_width: null,
    canvas_height: null,
    canvas_metadata: {},
    content_version: 1,
    lock_version: 1,
    created_at: now,
    updated_at: now,
  };
}

describe("buildDocumentationTree", () => {
  it("builds and recursively sorts multiple top-level document trees", () => {
    const tree = buildDocumentationTree([
      node("infra", null, 2),
      node("api", "platform", 1),
      node("platform", null, 0),
      node("auth", "platform", 0),
      node("sessions", "auth", 0),
    ]);

    assert.deepEqual(
      tree.roots.map((item) => item.id),
      ["platform", "infra"],
    );
    assert.deepEqual(
      tree.roots[0].children.map((item) => item.id),
      ["auth", "api"],
    );
    assert.equal(tree.roots[0].children[0].children[0].id, "sessions");
    assert.deepEqual(tree.orphaned, []);
  });

  it("surfaces nodes whose parent was not loaded", () => {
    const tree = buildDocumentationTree([
      node("orphan-b", "missing", 1),
      node("orphan-a", "missing", 0),
    ]);

    assert.deepEqual(
      tree.orphaned.map((item) => item.id),
      ["orphan-a", "orphan-b"],
    );
  });

  it("does not mutate flat input nodes", () => {
    const root = node("platform", null, 0);
    buildDocumentationTree([root, node("api", root.id, 0)]);
    assert.equal("children" in root, false);
  });
});

describe("resolveDocumentationAssetUrls", () => {
  it("resolves durable asset tokens without touching ordinary URLs", () => {
    const id = "10000000-0000-4000-8000-000000000001";
    assert.equal(
      resolveDocumentationAssetUrls(`![map](asset:${id})\n\n![remote](https://example.com/a.png)`),
      `![map](/api/docs/assets/${id}/content)\n\n![remote](https://example.com/a.png)`,
    );
  });

  it("converts editor routes back to durable asset tokens", () => {
    const id = "10000000-0000-4000-8000-000000000001";
    assert.equal(
      persistDocumentationAssetUrls(
        `![map](/api/docs/assets/${id}/content)\n\n![remote](https://example.com/a.png)`,
      ),
      `![map](asset:${id})\n\n![remote](https://example.com/a.png)`,
    );
  });
});

describe("documentation API validation", () => {
  it("accepts a bounded node create payload", () => {
    assert.equal(
      createNodeSchema.safeParse({
        title: "Platform",
        slug: "platform",
        canvas_x: 12.5,
        canvas_y: -20,
      }).success,
      true,
    );
  });

  it("rejects invalid slugs and non-finite positions", () => {
    assert.equal(
      createNodeSchema.safeParse({
        title: "Platform",
        slug: "Platform Map",
        canvas_x: Number.POSITIVE_INFINITY,
      }).success,
      false,
    );
  });

  it("requires complete optimistic move state", () => {
    assert.equal(
      updateNodeSchema.safeParse({
        operation: "move",
        expected_lock_version: 2,
        parent_id: null,
        sort_order: 0,
        canvas_x: 10,
        canvas_y: 20,
        canvas_width: 280,
        canvas_height: 150,
        canvas_metadata: {},
      }).success,
      true,
    );
    assert.equal(
      updateNodeSchema.safeParse({
        operation: "move",
        expected_lock_version: 2,
        canvas_x: 10,
      }).success,
      false,
    );
  });
});
