import { z } from "zod";

const taskFields = {
  parent_task_id: z.string().uuid().nullable().default(null),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase kebab-case slug"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().default(null),
  status: z
    .enum([
      "planned",
      "ready",
      "in_progress",
      "validating",
      "done",
      "blocked",
      "cancelled",
    ])
    .default("planned"),
  progress_percent: z.number().int().min(0).max(100).default(0),
  estimate_minutes: z.number().int().positive().nullable().default(null),
  planning_prompt: z.string().trim().min(1).max(20000),
  implementation_prompt: z.string().trim().min(1).max(20000),
  validation_gate: z.string().trim().min(1).max(20000),
  sort_order: z.number().int().min(0).default(0),
  dependency_ids: z.array(z.string().uuid()).max(100).default([]),
};

export const createRoadmapTaskSchema = z.object(taskFields).strict();

export const updateRoadmapTaskSchema = z
  .object({
    ...taskFields,
    expected_lock_version: z.number().int().positive(),
  })
  .strict();

export const deleteRoadmapTaskSchema = z
  .object({
    expected_lock_version: z.number().int().positive(),
  })
  .strict();

export type CreateRoadmapTaskInput = z.infer<typeof createRoadmapTaskSchema>;
export type UpdateRoadmapTaskInput = z.infer<typeof updateRoadmapTaskSchema>;
