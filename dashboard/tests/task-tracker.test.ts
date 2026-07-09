import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TaskTrackerItem } from "../../shared/types";
import {
  DeepSeekTaskParserError,
  parseTasksWithDeepSeek,
  resolveDeepSeekApiKey,
} from "../src/lib/deepseek-task-parser";
import {
  formatTaskTrackerDate,
  groupTaskTrackerItems,
} from "../src/lib/task-tracker-calendar";
import { upsertTaskDocumentationSection } from "../src/lib/task-tracker-actions";
import { taskTrackerLlmOutputSchema } from "../src/lib/task-tracker-validation";

function trackerItem(
  overrides: Partial<TaskTrackerItem> = {},
): TaskTrackerItem {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    project_id: "00000000-0000-4000-8000-000000000001",
    input_text: "Prepare launch",
    title: "Prepare launch brief",
    description: "Write the final launch brief.",
    priority: "high",
    scheduled_for: "2026-07-10",
    due_on: "2026-07-11",
    estimate_minutes: 60,
    documentation_update: "Record the launch scope and owners.",
    roadmap_description: "Prepare the launch brief.",
    roadmap_planning_prompt: "Gather launch scope and owners.",
    roadmap_implementation_prompt: "Write and publish the launch brief.",
    roadmap_validation_gate: "The launch owner approves the brief.",
    status: "pending",
    documentation_node_id: null,
    roadmap_task_id: null,
    action_error: null,
    lock_version: 1,
    actioned_at: null,
    created_at: "2026-07-09T00:00:00.000Z",
    updated_at: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

const llmTask = {
  title: "Prepare launch brief",
  description: "Write the final launch brief.",
  priority: "high",
  scheduled_for: "2026-07-10",
  due_on: "2026-07-11",
  estimate_minutes: 60,
  documentation_update: "Record the launch scope and owners.",
  roadmap_description: "Prepare the launch brief.",
  roadmap_planning_prompt: "Gather launch scope and owners.",
  roadmap_implementation_prompt: "Write and publish the launch brief.",
  roadmap_validation_gate: "The launch owner approves the brief.",
} as const;

describe("task tracker calendar", () => {
  it("groups by calendar date and orders priority within each day", () => {
    const groups = groupTaskTrackerItems([
      trackerItem({ id: "low", priority: "low" }),
      trackerItem({ id: "urgent", priority: "urgent" }),
      trackerItem({
        id: "later",
        priority: "high",
        scheduled_for: "2026-07-12",
      }),
    ]);

    assert.deepEqual(groups.map((group) => group.date), [
      "2026-07-10",
      "2026-07-12",
    ]);
    assert.deepEqual(groups[0].items.map((item) => item.id), ["urgent", "low"]);
    assert.equal(formatTaskTrackerDate("2026-07-10", "2026-07-09"), "Tomorrow");
  });
});

describe("task tracker schema", () => {
  it("rejects a due date before the scheduled date", () => {
    const parsed = taskTrackerLlmOutputSchema.safeParse({
      tasks: [{ ...llmTask, due_on: "2026-07-09" }],
    });
    assert.equal(parsed.success, false);
  });
});

describe("DeepSeek task parser", () => {
  it("uses the canonical DS_API secret and supports the legacy lowercase alias", () => {
    assert.equal(
      resolveDeepSeekApiKey(undefined, { DS_API: "canonical-key" }),
      "canonical-key",
    );
    assert.equal(
      resolveDeepSeekApiKey(undefined, { ds_api: "legacy-key" }),
      "legacy-key",
    );
  });

  it("prefers an explicit key, then the canonical secret", () => {
    assert.equal(
      resolveDeepSeekApiKey("explicit-key", {
        DS_API: "canonical-key",
        ds_api: "legacy-key",
      }),
      "explicit-key",
    );
    assert.equal(
      resolveDeepSeekApiKey(undefined, {
        DS_API: "canonical-key",
        ds_api: "legacy-key",
      }),
      "canonical-key",
    );
  });

  it("requests JSON and validates the structured response", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const result = await parseTasksWithDeepSeek("Prepare launch by Saturday", {
      apiKey: "test-key",
      now: new Date("2026-07-09T12:00:00.000Z"),
      timeZone: "UTC",
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ tasks: [llmTask] }) } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    assert.equal(result.tasks[0].priority, "high");
    assert.equal(requestBody?.model, "deepseek-chat");
    assert.deepEqual(requestBody?.response_format, { type: "json_object" });
    const messages = JSON.stringify(requestBody?.messages);
    assert.match(messages, /2026-07-09/);
    assert.match(messages, /exactly one implementation-ready roadmap task/);
    assert.match(messages, /do not split it into multiple tasks/);
  });

  it("fails closed when provider output is outside the schema", async () => {
    await assert.rejects(
      parseTasksWithDeepSeek("Do something", {
        apiKey: "test-key",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"tasks":[{"title":"Incomplete"}]}' } }],
            }),
            { status: 200 },
          ),
      }),
      (error: unknown) =>
        error instanceof DeepSeekTaskParserError &&
        error.code === "invalid_output",
    );
  });
});

describe("task documentation update", () => {
  it("is idempotent when the same task is actioned again", () => {
    const item = trackerItem();
    const first = upsertTaskDocumentationSection("# Updates", item);
    const second = upsertTaskDocumentationSection(first, {
      ...item,
      documentation_update: "Updated launch scope.",
    });

    assert.equal(second.match(/task-tracker:.*:start/g)?.length, 1);
    assert.doesNotMatch(second, /Record the launch scope/);
    assert.match(second, /Updated launch scope/);
  });
});
