import type {
  DocumentationNode,
  RoadmapTask,
  TaskTrackerItem,
  TaskTrackerStatus,
} from "@shared/types";
import { getSupabase } from "./data";
import { createRoadmapTask } from "./roadmap-actions";
import {
  DocumentationAgentError,
  runDocumentationAgent,
  type DocumentationAgentChange,
} from "./task-tracker-documentation-agent";

export { upsertTaskDocumentationSection } from "./task-tracker-documentation";

export type TaskTrackerActionResult =
  | {
      ok: true;
      data: {
        item: TaskTrackerItem;
        documentation: DocumentationNode;
        documentation_changes: DocumentationAgentChange[];
        agent_summary: string;
        roadmap: RoadmapTask;
      };
    }
  | {
      ok: false;
      code: "conflict" | "invalid" | "not_configured" | "not_found";
      error: string;
      data?: TaskTrackerItem;
    };

class TaskTrackerPipelineError extends Error {
  constructor(
    message: string,
    readonly code: "conflict" | "invalid" | "not_configured" | "not_found",
  ) {
    super(message);
  }
}

async function updateActionState(
  item: TaskTrackerItem,
  status: TaskTrackerStatus,
  documentationNodeId: string | null,
  roadmapTaskId: string | null,
  actionError: string | null,
): Promise<TaskTrackerItem> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new TaskTrackerPipelineError(
      "Supabase is not configured.",
      "not_configured",
    );
  }
  const { data, error } = await supabase
    .rpc("update_task_tracker_action", {
      p_item_id: item.id,
      p_expected_lock_version: item.lock_version,
      p_status: status,
      p_documentation_node_id: documentationNodeId,
      p_roadmap_task_id: roadmapTaskId,
      p_action_error: actionError,
    })
    .maybeSingle();
  if (error) throw new TaskTrackerPipelineError(error.message, "invalid");
  if (!data) {
    throw new TaskTrackerPipelineError(
      "The task changed while it was being actioned. Reload and try again.",
      "conflict",
    );
  }
  return data as TaskTrackerItem;
}

async function syncRoadmap(item: TaskTrackerItem): Promise<RoadmapTask> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new TaskTrackerPipelineError(
      "Supabase is not configured.",
      "not_configured",
    );
  }

  if (item.roadmap_task_id) {
    const linked = await supabase
      .from("roadmap_tasks")
      .select("*")
      .eq("id", item.roadmap_task_id)
      .eq("project_id", item.project_id)
      .maybeSingle();
    if (linked.error) {
      throw new TaskTrackerPipelineError(linked.error.message, "invalid");
    }
    if (linked.data) return linked.data as RoadmapTask;
  }

  const roadmapSlug = `task-${item.id}`;
  const existing = await supabase
    .from("roadmap_tasks")
    .select("*")
    .eq("project_id", item.project_id)
    .eq("slug", roadmapSlug)
    .is("parent_task_id", null)
    .maybeSingle();
  if (existing.error) {
    throw new TaskTrackerPipelineError(existing.error.message, "invalid");
  }
  if (existing.data) return existing.data as RoadmapTask;

  const lastTask = await supabase
    .from("roadmap_tasks")
    .select("sort_order")
    .eq("project_id", item.project_id)
    .is("parent_task_id", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastTask.error) {
    throw new TaskTrackerPipelineError(lastTask.error.message, "invalid");
  }

  const schedule = [
    `Priority: ${item.priority}.`,
    `Scheduled: ${item.scheduled_for}.`,
    item.due_on ? `Due: ${item.due_on}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const created = await createRoadmapTask({
    parent_task_id: null,
    slug: roadmapSlug,
    title: item.title,
    description: `${item.roadmap_description}\n\n${schedule}`,
    status: "ready",
    progress_percent: 0,
    estimate_minutes: item.estimate_minutes,
    planning_prompt: item.roadmap_planning_prompt,
    implementation_prompt: item.roadmap_implementation_prompt,
    validation_gate: item.roadmap_validation_gate,
    sort_order: ((lastTask.data?.sort_order as number | undefined) ?? -1) + 1,
    dependency_ids: [],
  });
  if (!created.ok) {
    throw new TaskTrackerPipelineError(created.error, created.code);
  }
  return created.data;
}

export async function actionTaskTrackerItem(
  itemId: string,
  expectedLockVersion: number,
): Promise<TaskTrackerActionResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      code: "not_configured",
      error: "Supabase is not configured.",
    };
  }

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const project = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (project.error || !project.data) {
    return { ok: false, code: "not_found", error: "Project not found." };
  }

  const loaded = await supabase
    .from("task_tracker_items")
    .select("*")
    .eq("id", itemId)
    .eq("project_id", project.data.id)
    .maybeSingle();
  if (loaded.error) {
    return { ok: false, code: "invalid", error: loaded.error.message };
  }
  if (!loaded.data) {
    return { ok: false, code: "not_found", error: "Task not found." };
  }

  let item = loaded.data as TaskTrackerItem;
  if (item.status === "actioned" && item.documentation_node_id && item.roadmap_task_id) {
    const [documentation, roadmap] = await Promise.all([
      supabase
        .from("documentation_nodes")
        .select("*")
        .eq("id", item.documentation_node_id)
        .maybeSingle(),
      supabase
        .from("roadmap_tasks")
        .select("*")
        .eq("id", item.roadmap_task_id)
        .maybeSingle(),
    ]);
    if (documentation.data && roadmap.data) {
      return {
        ok: true,
        data: {
          item,
          documentation: documentation.data as DocumentationNode,
          documentation_changes: [
            {
              operation: "updated",
              node: documentation.data as DocumentationNode,
            },
          ],
          agent_summary: `Documentation and roadmap already updated for ${item.title}.`,
          roadmap: roadmap.data as RoadmapTask,
        },
      };
    }
  }
  if (item.status === "cancelled") {
    return { ok: false, code: "invalid", error: "Cancelled tasks cannot be actioned." };
  }
  if (item.status === "completed") {
    return { ok: false, code: "invalid", error: "Completed tasks cannot be actioned." };
  }
  if (item.status === "actioning" || item.lock_version !== expectedLockVersion) {
    return {
      ok: false,
      code: "conflict",
      error: "This task is already changing. Reload and try again.",
      data: item,
    };
  }

  try {
    item = await updateActionState(
      item,
      "actioning",
      item.documentation_node_id,
      item.roadmap_task_id,
      null,
    );

    // The order is deliberate: product context is durable before work enters
    // the executable roadmap.
    const documentationResult = await runDocumentationAgent(item);
    const documentation = documentationResult.primaryNode;
    item = await updateActionState(
      item,
      "actioning",
      documentation.id,
      item.roadmap_task_id,
      null,
    );

    const roadmap = await syncRoadmap(item);
    item = await updateActionState(
      item,
      "actioned",
      documentation.id,
      roadmap.id,
      null,
    );
    return {
      ok: true,
      data: {
        item,
        documentation,
        documentation_changes: documentationResult.changes,
        agent_summary: documentationResult.summary,
        roadmap,
      },
    };
  } catch (error) {
    const pipelineError =
      error instanceof TaskTrackerPipelineError
        ? error
        : error instanceof DocumentationAgentError
          ? new TaskTrackerPipelineError(
              error.message,
              error.code === "not_configured" ? "not_configured" : "invalid",
            )
          : new TaskTrackerPipelineError(
              error instanceof Error ? error.message : "The task action failed.",
              "invalid",
            );
    try {
      item = await updateActionState(
        item,
        "failed",
        item.documentation_node_id,
        item.roadmap_task_id,
        pipelineError.message.slice(0, 2000),
      );
    } catch {
      // Preserve the original pipeline error if a concurrent write wins.
    }
    return {
      ok: false,
      code: pipelineError.code,
      error: pipelineError.message,
      data: item,
    };
  }
}
