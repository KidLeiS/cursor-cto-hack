import { z } from "zod";
import {
  createDocumentationNode,
  deleteDocumentationNode,
  updateDocumentationContent,
} from "./documentation-actions";
import { loadDocumentationNodes } from "./documentation";
import { loadDocumentationProject } from "./documentation-project";
import {
  createRoadmapTask,
  deleteRoadmapTask,
  updateRoadmapTask,
} from "./roadmap-actions";
import { loadRoadmapBundle } from "./roadmap";
import {
  createRoadmapTaskSchema,
  updateRoadmapTaskSchema,
} from "./roadmap-validation";

type JsonSchema = Record<string, unknown>;

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
};

const uuid = z.string().uuid();
const lockVersion = z.number().int().positive();
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const mcpTools: McpTool[] = [
  {
    name: "documentation_list",
    title: "List documentation",
    description:
      "List the project documentation tree. Returns document IDs and optimistic lock versions required for edits.",
    inputSchema: {
      type: "object",
      properties: {
        include_markdown: {
          type: "boolean",
          description: "Include complete Markdown bodies. Defaults to false.",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "documentation_get",
    title: "Read documentation",
    description: "Read one Markdown document by UUID.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "documentation_create",
    title: "Create documentation",
    description: "Create a Markdown document in the documentation tree.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 160 },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        markdown: { type: "string", maxLength: 500000 },
        parent_id: { type: ["string", "null"], format: "uuid" },
        sort_order: { type: "integer", minimum: 0 },
      },
      required: ["title", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "documentation_update",
    title: "Edit documentation",
    description:
      "Edit a document. First read it and pass its current lock_version. Omitted content fields keep their current values.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        expected_lock_version: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1, maxLength: 160 },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        markdown: { type: "string", maxLength: 500000 },
      },
      required: ["id", "expected_lock_version"],
      additionalProperties: false,
    },
    annotations: { idempotentHint: false },
  },
  {
    name: "documentation_delete",
    title: "Delete documentation",
    description:
      "Delete a document by UUID and lock version. A document with children cannot be deleted.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        expected_lock_version: { type: "integer", minimum: 1 },
      },
      required: ["id", "expected_lock_version"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
  },
  {
    name: "roadmap_list",
    title: "List roadmap",
    description:
      "List every roadmap task and dependency, including IDs and lock versions needed for edits.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "roadmap_get",
    title: "Read roadmap task",
    description: "Read one roadmap task and its dependency IDs.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", format: "uuid" } },
      required: ["id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "roadmap_create",
    title: "Create roadmap task",
    description:
      "Create a roadmap task. Planning, implementation, and validation prompts get useful defaults when omitted.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        description: { type: ["string", "null"], maxLength: 4000 },
        parent_task_id: { type: ["string", "null"], format: "uuid" },
        status: {
          type: "string",
          enum: ["planned", "ready", "in_progress", "validating", "done", "blocked", "cancelled"],
        },
        progress_percent: { type: "integer", minimum: 0, maximum: 100 },
        estimate_minutes: { type: ["integer", "null"], minimum: 1 },
        planning_prompt: { type: "string", maxLength: 20000 },
        implementation_prompt: { type: "string", maxLength: 20000 },
        validation_gate: { type: "string", maxLength: 20000 },
        sort_order: { type: "integer", minimum: 0 },
        dependency_ids: {
          type: "array",
          maxItems: 100,
          items: { type: "string", format: "uuid" },
        },
      },
      required: ["title", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "roadmap_update",
    title: "Edit roadmap task",
    description:
      "Edit a roadmap task. First read it and pass its current lock_version. Omitted fields keep their current values.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        expected_lock_version: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1, maxLength: 200 },
        slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
        description: { type: ["string", "null"], maxLength: 4000 },
        parent_task_id: { type: ["string", "null"], format: "uuid" },
        status: {
          type: "string",
          enum: ["planned", "ready", "in_progress", "validating", "done", "blocked", "cancelled"],
        },
        progress_percent: { type: "integer", minimum: 0, maximum: 100 },
        estimate_minutes: { type: ["integer", "null"], minimum: 1 },
        planning_prompt: { type: "string", maxLength: 20000 },
        implementation_prompt: { type: "string", maxLength: 20000 },
        validation_gate: { type: "string", maxLength: 20000 },
        sort_order: { type: "integer", minimum: 0 },
        dependency_ids: {
          type: "array",
          maxItems: 100,
          items: { type: "string", format: "uuid" },
        },
      },
      required: ["id", "expected_lock_version"],
      additionalProperties: false,
    },
  },
  {
    name: "roadmap_delete",
    title: "Delete roadmap task",
    description: "Delete a roadmap task and its descendants using its current lock version.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        expected_lock_version: { type: "integer", minimum: 1 },
      },
      required: ["id", "expected_lock_version"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
  },
];

const documentCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    slug,
    markdown: z.string().max(500_000).default(""),
    parent_id: uuid.nullable().default(null),
    sort_order: z.number().int().min(0).default(0),
  })
  .strict();

const documentUpdateSchema = z
  .object({
    id: uuid,
    expected_lock_version: lockVersion,
    title: z.string().trim().min(1).max(160).optional(),
    slug: slug.optional(),
    markdown: z.string().max(500_000).optional(),
  })
  .strict();

const createRoadmapSchema = createRoadmapTaskSchema.partial().required({
  title: true,
  slug: true,
});

const updateRoadmapPatchSchema = createRoadmapTaskSchema
  .partial()
  .extend({ id: uuid, expected_lock_version: lockVersion })
  .strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid tool arguments: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function assertAction<T>(
  result: { ok: true; data?: T } | { ok: false; error: string },
): T | true {
  if (!result.ok) throw new Error(result.error);
  return result.data ?? true;
}

export async function callMcpTool(name: string, rawArguments: unknown): Promise<unknown> {
  const args = rawArguments ?? {};

  if (name === "documentation_list") {
    const input = parse(
      z.object({ include_markdown: z.boolean().default(false) }).strict(),
      args,
    );
    const project = await loadDocumentationProject();
    if (!project) throw new Error("Documentation is not configured.");
    const nodes = await loadDocumentationNodes(project.id);
    return {
      project,
      documents: nodes.map((node) =>
        input.include_markdown ? node : { ...node, markdown: undefined },
      ),
    };
  }

  if (name === "documentation_get") {
    const input = parse(z.object({ id: uuid }).strict(), args);
    const project = await loadDocumentationProject();
    if (!project) throw new Error("Documentation is not configured.");
    const node = (await loadDocumentationNodes(project.id)).find(
      (item) => item.id === input.id,
    );
    if (!node) throw new Error("Document not found.");
    return node;
  }

  if (name === "documentation_create") {
    const input = parse(documentCreateSchema, args);
    const project = await loadDocumentationProject();
    if (!project) throw new Error("Documentation is not configured.");
    return assertAction(
      await createDocumentationNode({ project_id: project.id, ...input }),
    );
  }

  if (name === "documentation_update") {
    const input = parse(documentUpdateSchema, args);
    const project = await loadDocumentationProject();
    if (!project) throw new Error("Documentation is not configured.");
    const current = (await loadDocumentationNodes(project.id)).find(
      (item) => item.id === input.id,
    );
    if (!current) throw new Error("Document not found.");
    return assertAction(
      await updateDocumentationContent({
        id: current.id,
        expected_lock_version: input.expected_lock_version,
        title: input.title ?? current.title,
        slug: input.slug ?? current.slug,
        markdown: input.markdown ?? current.markdown,
      }),
    );
  }

  if (name === "documentation_delete") {
    const input = parse(
      z.object({ id: uuid, expected_lock_version: lockVersion }).strict(),
      args,
    );
    return assertAction(await deleteDocumentationNode(input));
  }

  if (name === "roadmap_list") {
    parse(z.object({}).strict(), args);
    const bundle = await loadRoadmapBundle();
    return {
      project: bundle.project,
      tasks: bundle.tasks,
      dependencies: bundle.dependencies,
      source: bundle.source,
    };
  }

  if (name === "roadmap_get") {
    const input = parse(z.object({ id: uuid }).strict(), args);
    const bundle = await loadRoadmapBundle();
    const task = bundle.tasks.find((item) => item.id === input.id);
    if (!task) throw new Error("Roadmap task not found.");
    return {
      ...task,
      dependency_ids: bundle.dependencies
        .filter((dependency) => dependency.task_id === task.id)
        .map((dependency) => dependency.depends_on_task_id),
    };
  }

  if (name === "roadmap_create") {
    const input = parse(createRoadmapSchema, args);
    const title = input.title.trim();
    const complete = parse(createRoadmapTaskSchema, {
      parent_task_id: null,
      description: null,
      status: "planned",
      progress_percent: 0,
      estimate_minutes: null,
      planning_prompt: `Plan the work required for: ${title}`,
      implementation_prompt: `Implement: ${title}`,
      validation_gate: `Verify the acceptance criteria for: ${title}`,
      sort_order: 0,
      dependency_ids: [],
      ...input,
    });
    return assertAction(await createRoadmapTask(complete));
  }

  if (name === "roadmap_update") {
    const input = parse(updateRoadmapPatchSchema, args);
    const bundle = await loadRoadmapBundle();
    const current = bundle.tasks.find((item) => item.id === input.id);
    if (!current) throw new Error("Roadmap task not found.");
    const dependencyIds = bundle.dependencies
      .filter((dependency) => dependency.task_id === current.id)
      .map((dependency) => dependency.depends_on_task_id);
    const complete = parse(updateRoadmapTaskSchema, {
      parent_task_id: current.parent_task_id,
      slug: current.slug,
      title: current.title,
      description: current.description,
      status: current.status,
      progress_percent: current.progress_percent,
      estimate_minutes: current.estimate_minutes,
      planning_prompt: current.planning_prompt,
      implementation_prompt: current.implementation_prompt,
      validation_gate: current.validation_gate,
      sort_order: current.sort_order,
      dependency_ids: dependencyIds,
      ...input,
    });
    return assertAction(await updateRoadmapTask(current.id, complete));
  }

  if (name === "roadmap_delete") {
    const input = parse(
      z.object({ id: uuid, expected_lock_version: lockVersion }).strict(),
      args,
    );
    return assertAction(
      await deleteRoadmapTask(input.id, input.expected_lock_version),
    );
  }

  throw new Error(`Unknown tool: ${name}`);
}
