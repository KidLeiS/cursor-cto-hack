import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  demoBundle,
  filterBundleForProject,
  hasSupabaseEnv,
  type DashboardBundle,
} from "./domain";
import type {
  AgentRun,
  DebugCase,
  Feature,
  Gate,
  Module,
  Project,
  Workplan,
  WorkplanStep,
} from "../../../shared/types";

export type { DashboardBundle } from "./domain";
export {
  demoBundle,
  filterBundleForProject,
  hasSupabaseEnv,
  projectRefFromSupabaseUrl,
  dbHostFromSupabaseUrl,
  stepsByWorkplan,
} from "./domain";

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseEnv()) return null;
  const url =
    process.env.SB_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SB_PK || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(
    url!,
    key!,
  );
}

export async function loadDashboardBundle(): Promise<DashboardBundle> {
  const supabase = getSupabase();
  const slug = process.env.NEXT_PUBLIC_PROJECT_SLUG || "cursor-cto-hack";

  if (!supabase) return demoBundle();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (projectError || !project) return demoBundle();

  const projectId = project.id as string;

  const [modules, features, gates, agentRuns, workplans, steps, debugCases] =
    await Promise.all([
      supabase.from("modules").select("*").eq("project_id", projectId),
      supabase.from("features").select("*").eq("project_id", projectId),
      supabase.from("gates").select("*"),
      supabase.from("agent_runs").select("*").eq("project_id", projectId),
      supabase.from("workplans").select("*"),
      supabase.from("workplan_steps").select("*"),
      supabase.from("debug_cases").select("*"),
    ]);

  const filtered = filterBundleForProject({
    project: project as Project,
    modules: (modules.data ?? []) as Module[],
    features: (features.data ?? []) as Feature[],
    gates: (gates.data ?? []) as Gate[],
    agentRuns: (agentRuns.data ?? []) as AgentRun[],
    workplans: (workplans.data ?? []) as Workplan[],
    steps: (steps.data ?? []) as WorkplanStep[],
    debugCases: (debugCases.data ?? []) as DebugCase[],
  });

  return { ...filtered, source: "supabase" };
}
