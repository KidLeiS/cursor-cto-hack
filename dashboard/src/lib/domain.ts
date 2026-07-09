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

export type DashboardBundle = {
  project: Project;
  modules: Module[];
  features: Feature[];
  gates: Gate[];
  agentRuns: AgentRun[];
  workplans: Workplan[];
  steps: WorkplanStep[];
  debugCases: DebugCase[];
  source: "supabase" | "demo";
};

/** Pure helpers — unit-tested without Next/Supabase. */

export function hasSupabaseEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const url = env.SB_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SB_PK || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

export function projectRefFromSupabaseUrl(url: string): string {
  const host = new URL(url).hostname;
  const ref = host.split(".")[0];
  if (!ref || ref === "supabase") {
    throw new Error(`Invalid Supabase URL host: ${host}`);
  }
  return ref;
}

export function dbHostFromSupabaseUrl(url: string): string {
  return `db.${projectRefFromSupabaseUrl(url)}.supabase.co`;
}

export function filterBundleForProject(input: {
  project: Project;
  modules: Module[];
  features: Feature[];
  gates: Gate[];
  agentRuns: AgentRun[];
  workplans: Workplan[];
  steps: WorkplanStep[];
  debugCases: DebugCase[];
}): Omit<DashboardBundle, "source"> {
  const featureIds = new Set(input.features.map((f) => f.id));
  const runIds = new Set(input.agentRuns.map((r) => r.id));
  const workplans = input.workplans.filter((w) => runIds.has(w.agent_run_id));
  const workplanIds = new Set(workplans.map((w) => w.id));

  return {
    project: input.project,
    modules: input.modules,
    features: input.features,
    gates: input.gates.filter((g) => featureIds.has(g.feature_id)),
    agentRuns: input.agentRuns,
    workplans,
    steps: input.steps.filter((s) => workplanIds.has(s.workplan_id)),
    debugCases: input.debugCases.filter((d) => runIds.has(d.agent_run_id)),
  };
}

export function stepsByWorkplan(
  steps: WorkplanStep[],
): Map<string, WorkplanStep[]> {
  const map = new Map<string, WorkplanStep[]>();
  for (const step of steps) {
    const list = map.get(step.workplan_id) ?? [];
    list.push(step);
    map.set(step.workplan_id, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }
  return map;
}

/** Demo data so the dashboard renders before Supabase is wired. */
export function demoBundle(): DashboardBundle {
  const now = new Date().toISOString();
  const projectId = "00000000-0000-4000-8000-000000000001";
  const featureId = "00000000-0000-4000-8000-000000000010";
  const runFeatureId = "00000000-0000-4000-8000-000000000020";
  const runDebugId = "00000000-0000-4000-8000-000000000021";
  const workplanId = "00000000-0000-4000-8000-000000000030";
  const debugWorkplanId = "00000000-0000-4000-8000-000000000031";
  const moduleAuth = "00000000-0000-4000-8000-000000000040";
  const moduleApi = "00000000-0000-4000-8000-000000000041";

  return {
    source: "demo",
    project: {
      id: projectId,
      slug: "cursor-cto-hack",
      name: "Cursor CTO Hack",
      repo_url: "https://github.com/KidLeiS/cursor-cto-hack",
      created_at: now,
      updated_at: now,
    },
    modules: [
      {
        id: moduleAuth,
        project_id: projectId,
        slug: "auth",
        name: "Auth",
        purpose: "Session and identity boundaries",
        public_api: "signIn, signOut, requireUser",
        invariants: "All mutating routes require a verified user",
        depends_on: [],
        readme_path: "modules/auth/README.md",
        map_path: "modules/auth/MAP.md",
        created_at: now,
        updated_at: now,
      },
      {
        id: moduleApi,
        project_id: projectId,
        slug: "api",
        name: "API",
        purpose: "HTTP surface for the product",
        public_api: "REST handlers under /api",
        invariants: "No business logic in transport adapters",
        depends_on: ["auth"],
        readme_path: "modules/api/README.md",
        map_path: "modules/api/MAP.md",
        created_at: now,
        updated_at: now,
      },
    ],
    features: [
      {
        id: featureId,
        project_id: projectId,
        slug: "workplan-dashboard",
        title: "Editable workplan dashboard",
        summary:
          "Vercel dashboard to view Feature/Debug runs and edit workplan steps before implementers run.",
        status: "in_progress",
        frontend_notes: "Built manually in Next.js on Vercel",
        backend_notes: "Supabase as shared context for agents",
        module_ids: [moduleApi],
        created_at: now,
        updated_at: now,
      },
    ],
    gates: [
      {
        id: "00000000-0000-4000-8000-000000000050",
        feature_id: featureId,
        parent_gate_id: null,
        level: "feature",
        title: "Workplan edits persist",
        criteria:
          "Editing a step on the dashboard updates Supabase and is re-read by implementers",
        status: "pending",
        evidence: null,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      },
      {
        id: "00000000-0000-4000-8000-000000000051",
        feature_id: featureId,
        parent_gate_id: null,
        level: "feature",
        title: "Feature and Debug runs visible",
        criteria:
          "Dashboard lists both agent kinds with status and linked workplans",
        status: "pass",
        evidence: "Demo bundle renders both run cards",
        sort_order: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    agentRuns: [
      {
        id: runFeatureId,
        project_id: projectId,
        kind: "feature",
        status: "planning",
        feature_id: featureId,
        title: "Plan workplan dashboard backend",
        intent: "Expose shared context + editable workplans for Feature agent",
        harness: "cursor",
        external_run_url: null,
        model_plan: "high",
        model_implement: "cheap",
        error: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: runDebugId,
        project_id: projectId,
        kind: "debug",
        status: "queued",
        feature_id: featureId,
        title: "Fix stale workplan after dashboard edit",
        intent:
          "Implementer ignored dashboard edits — ensure re-read from Supabase",
        harness: "cursor",
        external_run_url: null,
        model_plan: "high",
        model_implement: "cheap",
        error: null,
        created_at: now,
        updated_at: now,
      },
    ],
    workplans: [
      {
        id: workplanId,
        agent_run_id: runFeatureId,
        feature_id: featureId,
        summary: "Stand up Supabase schema and dashboard CRUD for workplan steps",
        architecture_notes:
          "Git holds architecture docs; Supabase holds mutable ops state; Vercel is the human control surface.",
        editable: true,
        version: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: debugWorkplanId,
        agent_run_id: runDebugId,
        feature_id: featureId,
        summary: "Make implement prompts always reload step from Supabase",
        architecture_notes: "Prompt contract: dashboard edits win",
        editable: true,
        version: 1,
        created_at: now,
        updated_at: now,
      },
    ],
    steps: [
      {
        id: "00000000-0000-4000-8000-000000000060",
        workplan_id: workplanId,
        sort_order: 0,
        title: "Apply Supabase migration",
        implementation_plan:
          "Run supabase/migrations/001_init.sql on the project; confirm seed project row.",
        validation_requirements:
          "Tables exist; seed project slug cursor-cto-hack present",
        target_module_ids: [],
        status: "ready",
        gate_ids: [],
        created_at: now,
        updated_at: now,
      },
      {
        id: "00000000-0000-4000-8000-000000000061",
        workplan_id: workplanId,
        sort_order: 1,
        title: "Wire dashboard to Supabase",
        implementation_plan:
          "Set NEXT_PUBLIC_SUPABASE_* env on Vercel; replace demo fallback when connected.",
        validation_requirements:
          "Dashboard source badge shows supabase; workplan edit persists",
        target_module_ids: [moduleApi],
        status: "pending",
        gate_ids: ["00000000-0000-4000-8000-000000000050"],
        created_at: now,
        updated_at: now,
      },
      {
        id: "00000000-0000-4000-8000-000000000070",
        workplan_id: debugWorkplanId,
        sort_order: 0,
        title: "Harden implement prompt re-read",
        implementation_plan:
          "Ensure feature-implement / debug-implement prompts require Supabase reload before coding.",
        validation_requirements:
          "Prompt files mention dashboard edits win; skill checklists agree",
        target_module_ids: [],
        status: "ready",
        gate_ids: [],
        created_at: now,
        updated_at: now,
      },
    ],
    debugCases: [
      {
        id: "00000000-0000-4000-8000-000000000080",
        agent_run_id: runDebugId,
        symptom:
          "Implementer used stale step text after human edited workplan on dashboard",
        repro_steps: "Edit step on dashboard → run implement prompt without re-fetch",
        suspected_modules: [],
        failing_gate_ids: ["00000000-0000-4000-8000-000000000050"],
        root_cause: null,
        fix_summary: null,
        created_at: now,
        updated_at: now,
      },
    ],
  };
}
