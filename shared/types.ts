/** Shared domain types for dashboard, skills, and prompts (Option B). */

export type FeatureStatus =
  | "idea"
  | "planned"
  | "in_progress"
  | "validating"
  | "done"
  | "blocked";

export type GateLevel = "feature" | "subfeature" | "step";
export type GateStatus = "pending" | "pass" | "fail" | "skipped";

export type AgentKind = "feature" | "debug";

export type AgentRunStatus =
  | "queued"
  | "planning"
  | "implementing"
  | "validating"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkplanStepStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "done"
  | "blocked"
  | "skipped";

export type Harness = "cursor" | "codex" | "claude";

export interface Project {
  id: string;
  slug: string;
  name: string;
  repo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  purpose: string | null;
  public_api: string | null;
  invariants: string | null;
  depends_on: string[];
  readme_path: string | null;
  map_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Feature {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: FeatureStatus;
  frontend_notes: string | null;
  backend_notes: string | null;
  module_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Gate {
  id: string;
  feature_id: string;
  parent_gate_id: string | null;
  level: GateLevel;
  title: string;
  criteria: string;
  status: GateStatus;
  evidence: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  project_id: string;
  kind: AgentKind;
  status: AgentRunStatus;
  feature_id: string | null;
  title: string;
  intent: string;
  harness: Harness;
  external_run_url: string | null;
  model_plan: string | null;
  model_implement: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workplan {
  id: string;
  agent_run_id: string;
  feature_id: string | null;
  summary: string;
  architecture_notes: string | null;
  editable: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkplanStep {
  id: string;
  workplan_id: string;
  sort_order: number;
  title: string;
  implementation_plan: string;
  validation_requirements: string;
  target_module_ids: string[];
  status: WorkplanStepStatus;
  gate_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DebugCase {
  id: string;
  agent_run_id: string;
  symptom: string;
  repro_steps: string | null;
  suspected_modules: string[];
  failing_gate_ids: string[];
  root_cause: string | null;
  fix_summary: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload a Feature agent writes after planning. */
export interface FeaturePlanOutput {
  feature: Pick<Feature, "slug" | "title" | "summary" | "backend_notes" | "module_ids">;
  gates: Array<Pick<Gate, "title" | "criteria" | "level" | "sort_order">>;
  workplan: {
    summary: string;
    architecture_notes?: string;
    steps: Array<
      Pick<
        WorkplanStep,
        | "title"
        | "implementation_plan"
        | "validation_requirements"
        | "target_module_ids"
        | "sort_order"
      >
    >;
  };
}

/** Payload a Debug agent writes after triage. */
export interface DebugPlanOutput {
  debug_case: Pick<
    DebugCase,
    "symptom" | "repro_steps" | "suspected_modules" | "failing_gate_ids"
  >;
  workplan: {
    summary: string;
    architecture_notes?: string;
    steps: Array<
      Pick<
        WorkplanStep,
        | "title"
        | "implementation_plan"
        | "validation_requirements"
        | "target_module_ids"
        | "sort_order"
      >
    >;
  };
}
