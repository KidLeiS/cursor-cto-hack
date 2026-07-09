"use server";

import { revalidatePath } from "next/cache";
import type { RoadmapTask } from "@shared/types";
import { getSupabase } from "./data";
import type {
  CreateRoadmapTaskInput,
  UpdateRoadmapTaskInput,
} from "./roadmap-validation";

export type RoadmapActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code: "conflict" | "invalid" | "not_configured" | "not_found";
    };

function refreshRoadmap(): void {
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function createRoadmapTask(
  input: CreateRoadmapTaskInput,
): Promise<RoadmapActionResult<RoadmapTask>> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured",
      code: "not_configured",
    };
  }

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (projectError || !project) {
    return { ok: false, error: "Project not found", code: "not_found" };
  }

  const { data, error } = await supabase.rpc("create_roadmap_task", {
    p_project_id: project.id,
    p_parent_task_id: input.parent_task_id,
    p_slug: input.slug,
    p_title: input.title,
    p_description: input.description,
    p_status: input.status,
    p_progress_percent: input.progress_percent,
    p_estimate_minutes: input.estimate_minutes,
    p_planning_prompt: input.planning_prompt,
    p_implementation_prompt: input.implementation_prompt,
    p_validation_gate: input.validation_gate,
    p_sort_order: input.sort_order,
    p_dependency_ids: input.dependency_ids,
  });
  if (error) return { ok: false, error: error.message, code: "invalid" };

  const task = (data as RoadmapTask[] | null)?.[0];
  if (!task) {
    return { ok: false, error: "Task was not created", code: "invalid" };
  }
  refreshRoadmap();
  return { ok: true, data: task };
}

export async function updateRoadmapTask(
  taskId: string,
  input: UpdateRoadmapTaskInput,
): Promise<RoadmapActionResult<RoadmapTask>> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured",
      code: "not_configured",
    };
  }

  const { data, error } = await supabase.rpc("update_roadmap_task", {
    p_task_id: taskId,
    p_expected_lock_version: input.expected_lock_version,
    p_parent_task_id: input.parent_task_id,
    p_slug: input.slug,
    p_title: input.title,
    p_description: input.description,
    p_status: input.status,
    p_progress_percent: input.progress_percent,
    p_estimate_minutes: input.estimate_minutes,
    p_planning_prompt: input.planning_prompt,
    p_implementation_prompt: input.implementation_prompt,
    p_validation_gate: input.validation_gate,
    p_sort_order: input.sort_order,
    p_dependency_ids: input.dependency_ids,
  });
  if (error) return { ok: false, error: error.message, code: "invalid" };

  const task = (data as RoadmapTask[] | null)?.[0];
  if (!task) {
    return {
      ok: false,
      error: "Task changed or no longer exists",
      code: "conflict",
    };
  }
  refreshRoadmap();
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, data: task };
}

export async function deleteRoadmapTask(
  taskId: string,
  expectedLockVersion: number,
): Promise<RoadmapActionResult<boolean>> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      error: "Supabase is not configured",
      code: "not_configured",
    };
  }

  const { data, error } = await supabase.rpc("delete_roadmap_task", {
    p_task_id: taskId,
    p_expected_lock_version: expectedLockVersion,
  });
  if (error) return { ok: false, error: error.message, code: "invalid" };
  if (!data) {
    return {
      ok: false,
      error: "Task changed or no longer exists",
      code: "conflict",
    };
  }
  refreshRoadmap();
  return { ok: true, data: true };
}
