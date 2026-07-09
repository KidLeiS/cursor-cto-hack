import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GET as listTrackerItems,
  POST as createTrackerItems,
} from "../src/app/api/task-tracker/route";
import { POST as actionTrackerItem } from "../src/app/api/task-tracker/[id]/action/route";
import {
  DELETE as deleteTrackerItem,
  PATCH as updateTrackerItem,
} from "../src/app/api/task-tracker/[id]/route";

describe("task tracker endpoints", () => {
  it("lists the calendar demo without service credentials", async () => {
    const response = await listTrackerItems();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.source, "demo");
    assert.equal(body.data.length, 3);
    assert.ok(body.data.every((item: { scheduled_for?: string }) => item.scheduled_for));
  });

  it("rejects short input before calling DeepSeek", async () => {
    const response = await createTrackerItems(
      new Request("http://localhost/api/task-tracker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: "x", time_zone: "UTC" }),
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.ok, false);
  });

  it("rejects malformed action ids before loading storage", async () => {
    const response = await actionTrackerItem(
      new Request("http://localhost/api/task-tracker/not-an-id/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expected_lock_version: 1 }),
      }),
      { params: Promise.resolve({ id: "not-an-id" }) },
    );
    assert.equal(response.status, 400);
  });

  it("rejects malformed mutation ids before loading storage", async () => {
    const context = { params: Promise.resolve({ id: "not-an-id" }) };
    const updateResponse = await updateTrackerItem(
      new Request("http://localhost/api/task-tracker/not-an-id", {
        method: "PATCH",
        body: JSON.stringify({
          operation: "complete",
          expected_lock_version: 1,
        }),
      }),
      context,
    );
    const deleteResponse = await deleteTrackerItem(
      new Request("http://localhost/api/task-tracker/not-an-id", {
        method: "DELETE",
        body: JSON.stringify({ expected_lock_version: 1 }),
      }),
      context,
    );

    assert.equal(updateResponse.status, 400);
    assert.equal(deleteResponse.status, 400);
  });

  it("rejects invalid mutation payloads before loading storage", async () => {
    const response = await updateTrackerItem(
      new Request(
        "http://localhost/api/task-tracker/30000000-0000-4000-8000-000000000001",
        {
          method: "PATCH",
          body: JSON.stringify({ operation: "complete" }),
        },
      ),
      {
        params: Promise.resolve({
          id: "30000000-0000-4000-8000-000000000001",
        }),
      },
    );
    assert.equal(response.status, 400);
  });
});
