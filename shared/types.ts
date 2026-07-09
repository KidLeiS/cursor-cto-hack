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

export type RoadmapTaskStatus =
  | "planned"
  | "ready"
  | "in_progress"
  | "validating"
  | "done"
  | "blocked"
  | "cancelled";

export type TaskTrackerPriority = "urgent" | "high" | "medium" | "low";
export type TaskTrackerStatus =
  | "pending"
  | "actioning"
  | "actioned"
  | "failed"
  | "cancelled";

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

/**
 * The shared core model for both roadmap tasks and subtasks.
 * A null parent_task_id denotes a top-level task; every other field has the
 * same meaning at every depth.
 */
export interface RoadmapTask {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  status: RoadmapTaskStatus;
  progress_percent: number;
  estimate_minutes: number | null;
  planning_prompt: string;
  implementation_prompt: string;
  validation_gate: string;
  sort_order: number;
  lock_version: number;
  created_at: string;
  updated_at: string;
}

/** A directed edge: task_id cannot start until depends_on_task_id is complete. */
export interface RoadmapTaskDependency {
  id: string;
  project_id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
}

/**
 * A client-facing calendar item. It remains separate from the implementation
 * roadmap until a product manager actions it.
 */
export interface TaskTrackerItem {
  id: string;
  project_id: string;
  input_text: string;
  title: string;
  description: string;
  priority: TaskTrackerPriority;
  scheduled_for: string;
  due_on: string | null;
  estimate_minutes: number | null;
  documentation_update: string;
  roadmap_description: string;
  roadmap_planning_prompt: string;
  roadmap_implementation_prompt: string;
  roadmap_validation_gate: string;
  status: TaskTrackerStatus;
  documentation_node_id: string | null;
  roadmap_task_id: string | null;
  action_error: string | null;
  lock_version: number;
  actioned_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentationCanvasMetadata = Record<string, unknown>;

/** A Markdown document and its position in the project's flexible tree canvas. */
export interface DocumentationNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  markdown: string;
  sort_order: number;
  canvas_x: number;
  canvas_y: number;
  canvas_width: number | null;
  canvas_height: number | null;
  canvas_metadata: DocumentationCanvasMetadata;
  content_version: number;
  lock_version: number;
  created_at: string;
  updated_at: string;
}

/** Immutable content snapshot created before a document content update. */
export interface DocumentationRevision {
  id: string;
  project_id: string;
  node_id: string;
  content_version: number;
  slug: string;
  title: string;
  markdown: string;
  created_at: string;
}

/** Metadata for an image whose bytes are held in Supabase Storage. */
export interface DocumentationAsset {
  id: string;
  project_id: string;
  node_id: string;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  archived_at: string | null;
  created_at: string;
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
