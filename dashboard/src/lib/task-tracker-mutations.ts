import { revalidatePath } from "next/cache";
import type { TaskTrackerItem } from "@shared/types";
import { getSupabase } from "./data";
import type { UpdateTaskTrackerItemInput } from "./task-tracker-validation";

export type TaskTrackerMutationResult =
  | { ok: true; data: TaskTrackerItem }
  | {
      ok: false;
      code: "conflict" | "invalid" | "not_configured" | "not_found";
      error: string;
      data?: TaskTrackerItem;
    };

type LoadedItem =
  | { ok: true; item: TaskTrackerItem }
  | Extract<TaskTrackerMutationResult, { ok: false }>;

async function loadCurrentItem(itemId: string): Promise<LoadedItem> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      code: "not_configured",
      error: "Supabase is not configured.",
    };
  }

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (projectError || !project) {
    return { ok: false, code: "not_found", error: "Project not found." };
  }

  const { data, error } = await supabase
    .from("task_tracker_items")
    .select("*")
    .eq("id", itemId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (error) return { ok: false, code: "invalid", error: error.message };
  if (!data) return { ok: false, code: "not_found", error: "Task not found." };
  return { ok: true, item: data as TaskTrackerItem };
}

function refreshTracker(): void {
  revalidatePath("/");
}

export async function updateTaskTrackerItem(
  itemId: string,
  input: UpdateTaskTrackerItemInput,
): Promise<TaskTrackerMutationResult> {
  const loaded = await loadCurrentItem(itemId);
  if (!loaded.ok) return loaded;
  const current = loaded.item;
  if (current.lock_version !== input.expected_lock_version) {
    return {
      ok: false,
      code: "conflict",
      error: "The task changed after it was opened. Reload and try again.",
      data: current,
    };
  }

  if (
    input.operation === "edit" &&
    !["pending", "failed"].includes(current.status)
  ) {
    return {
      ok: false,
      code: "invalid",
      error: "Only pending tasks can be edited.",
      data: current,
    };
  }
  if (
    input.operation === "reschedule" &&
    ["actioning", "cancelled", "completed"].includes(current.status)
  ) {
    return {
      ok: false,
      code: "invalid",
      error: "This task can no longer be rescheduled.",
      data: current,
    };
  }
  if (
    input.operation === "complete" &&
    ["actioning", "cancelled", "completed"].includes(current.status)
  ) {
    return {
      ok: false,
      code: "invalid",
      error: "This task cannot be completed from its current state.",
      data: current,
    };
  }

  const supabase = getSupabase()!;
  const rpc =
    input.operation === "edit"
      ? supabase.rpc("update_task_tracker_item", {
          p_item_id: itemId,
          p_expected_lock_version: input.expected_lock_version,
          p_title: input.title,
          p_description: input.description,
          p_priority: input.priority,
          p_scheduled_for: input.scheduled_for,
          p_due_on: input.due_on,
          p_estimate_minutes: input.estimate_minutes,
        })
      : input.operation === "reschedule"
        ? supabase.rpc("reschedule_task_tracker_item", {
            p_item_id: itemId,
            p_expected_lock_version: input.expected_lock_version,
            p_scheduled_for: input.scheduled_for,
            p_due_on: input.due_on,
          })
        : supabase.rpc("complete_task_tracker_item", {
            p_item_id: itemId,
            p_expected_lock_version: input.expected_lock_version,
          });

  const { data, error } = await rpc.maybeSingle();
  if (error) return { ok: false, code: "invalid", error: error.message };
  if (!data) {
    const latest = await loadCurrentItem(itemId);
    return {
      ok: false,
      code: "conflict",
      error: "The task changed while it was being saved.",
      data: latest.ok ? latest.item : current,
    };
  }
  refreshTracker();
  return { ok: true, data: data as TaskTrackerItem };
}

export async function deleteTaskTrackerItem(
  itemId: string,
  expectedLockVersion: number,
): Promise<TaskTrackerMutationResult> {
  const loaded = await loadCurrentItem(itemId);
  if (!loaded.ok) return loaded;
  const current = loaded.item;
  if (current.lock_version !== expectedLockVersion) {
    return {
      ok: false,
      code: "conflict",
      error: "The task changed after it was opened. Reload and try again.",
      data: current,
    };
  }
  if (current.status === "actioning") {
    return {
      ok: false,
      code: "invalid",
      error: "A task cannot be deleted while it is being actioned.",
      data: current,
    };
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase.rpc("delete_task_tracker_item", {
    p_item_id: itemId,
    p_expected_lock_version: expectedLockVersion,
  });
  if (error) return { ok: false, code: "invalid", error: error.message };
  if (!data) {
    return {
      ok: false,
      code: "conflict",
      error: "The task changed or no longer exists.",
      data: current,
    };
  }
  refreshTracker();
  return { ok: true, data: current };
}
