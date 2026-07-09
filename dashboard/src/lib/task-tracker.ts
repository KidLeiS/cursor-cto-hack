import type {
  Project,
  TaskTrackerItem,
} from "@shared/types";
import { getSupabase } from "./data";
import type { TaskTrackerLlmItem } from "./task-tracker-validation";

export type TaskTrackerBundle = {
  project: Project;
  items: TaskTrackerItem[];
  source: "supabase" | "demo";
};

export type TaskTrackerCreateResult =
  | { ok: true; data: TaskTrackerItem[] }
  | {
      ok: false;
      code: "not_configured" | "not_found" | "invalid";
      error: string;
    };

const DEMO_PROJECT_ID = "00000000-0000-4000-8000-000000000001";

function isoDateAtOffset(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function demoTaskTrackerBundle(): TaskTrackerBundle {
  const now = new Date().toISOString();
  const project: Project = {
    id: DEMO_PROJECT_ID,
    slug: "cursor-cto-hack",
    name: "Cursor CTO Hack",
    repo_url: "https://github.com/KidLeiS/cursor-cto-hack",
    created_at: now,
    updated_at: now,
  };
  const defaults = {
    project_id: project.id,
    input_text: "Demo client delivery plan",
    status: "pending",
    documentation_node_id: null,
    roadmap_task_id: null,
    action_error: null,
    lock_version: 1,
    actioned_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  } as const;
  const items: TaskTrackerItem[] = [
    {
      ...defaults,
      id: "30000000-0000-4000-8000-000000000001",
      title: "Confirm launch acceptance criteria",
      description: "Align the client and delivery team on the final launch checklist.",
      priority: "urgent",
      scheduled_for: isoDateAtOffset(0),
      due_on: isoDateAtOffset(0),
      estimate_minutes: 45,
      documentation_update:
        "## Launch acceptance criteria\n\nRecord the agreed release checks, owners, and sign-off path.",
      roadmap_description: "Finalize and publish the launch acceptance criteria.",
      roadmap_planning_prompt: "Review current release gates and identify missing owners.",
      roadmap_implementation_prompt:
        "Publish the agreed checklist and connect each check to an accountable owner.",
      roadmap_validation_gate:
        "The client and delivery lead have approved every launch check.",
    },
    {
      ...defaults,
      id: "30000000-0000-4000-8000-000000000002",
      title: "Prepare weekly client progress note",
      description: "Summarize completed work, current risks, and next decisions.",
      priority: "high",
      scheduled_for: isoDateAtOffset(1),
      due_on: isoDateAtOffset(1),
      estimate_minutes: 30,
      documentation_update:
        "## Weekly client update\n\nSummarize outcomes, open risks, and decisions needed from the client.",
      roadmap_description: "Produce the weekly client-facing progress summary.",
      roadmap_planning_prompt: "Collect this week's outcomes, risks, and pending decisions.",
      roadmap_implementation_prompt:
        "Draft and publish a concise progress note with owners and next steps.",
      roadmap_validation_gate:
        "The note accurately reflects delivery status and has no ownerless next steps.",
    },
    {
      ...defaults,
      id: "30000000-0000-4000-8000-000000000003",
      title: "Schedule analytics handoff",
      description: "Arrange the product analytics walkthrough with the client team.",
      priority: "medium",
      scheduled_for: isoDateAtOffset(3),
      due_on: isoDateAtOffset(5),
      estimate_minutes: 20,
      documentation_update:
        "## Analytics handoff\n\nDocument the walkthrough agenda, participants, and follow-up materials.",
      roadmap_description: "Coordinate and document the analytics handoff.",
      roadmap_planning_prompt: "Identify attendees, agenda, and required analytics materials.",
      roadmap_implementation_prompt:
        "Schedule the walkthrough and circulate the agenda and preparation links.",
      roadmap_validation_gate:
        "The meeting is accepted by required attendees and the agenda is published.",
    },
  ];
  return { project, items, source: "demo" };
}

export async function loadTaskTrackerBundle(): Promise<TaskTrackerBundle> {
  const supabase = getSupabase();
  if (!supabase) return demoTaskTrackerBundle();

  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (projectError) {
    throw new Error(`Unable to load task tracker project: ${projectError.message}`);
  }
  if (!project) return demoTaskTrackerBundle();

  const { data, error } = await supabase
    .from("task_tracker_items")
    .select("*")
    .eq("project_id", project.id)
    .order("scheduled_for")
    .order("created_at");
  if (error) throw new Error(`Unable to load task tracker: ${error.message}`);

  return {
    project: project as Project,
    items: (data ?? []) as TaskTrackerItem[],
    source: "supabase",
  };
}

export async function createTaskTrackerItems(
  inputText: string,
  parsedItems: TaskTrackerLlmItem[],
): Promise<TaskTrackerCreateResult> {
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
    .insert(
      parsedItems.map((item) => ({
        project_id: project.id,
        input_text: inputText,
        ...item,
      })),
    )
    .select("*");
  if (error) return { ok: false, code: "invalid", error: error.message };
  return { ok: true, data: (data ?? []) as TaskTrackerItem[] };
}
