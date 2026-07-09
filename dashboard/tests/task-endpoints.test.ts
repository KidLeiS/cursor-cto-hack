import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GET as listTasks, POST as createTask } from "../src/app/api/tasks/route";
import { GET as getTask } from "../src/app/api/tasks/[id]/route";

describe("task endpoints", () => {
  it("lists seeded top-level tasks with progress and remaining estimate", async () => {
    const response = await listTasks();
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "demo");
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].progress_percent, 48);
    assert.equal(body.data[0].estimated_remaining_minutes, 312);
    assert.equal(body.data[0].subtask_count, 4);
  });

  it("returns a seeded task DAG with exact contracts", async () => {
    const id = "10000000-0000-4000-8000-000000000001";
    const response = await getTask(new Request(`http://localhost/api/tasks/${id}`), {
      params: Promise.resolve({ id }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.tasks.length, 4);
    assert.equal(body.data.dependencies.length, 3);
    assert.match(body.data.tasks[0].planning_prompt, /core model/i);
    assert.match(body.data.tasks[0].validation_gate, /migration applies/i);
  });

  it("rejects malformed create payloads before touching the database", async () => {
    const response = await createTask(
      new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "" }),
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid task");
    assert.ok(body.issues.length > 0);
  });

  it("rejects malformed task ids", async () => {
    const response = await getTask(
      new Request("http://localhost/api/tasks/not-an-id"),
      { params: Promise.resolve({ id: "not-an-id" }) },
    );
    assert.equal(response.status, 400);
  });
});
