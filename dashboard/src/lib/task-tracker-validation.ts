import { z } from "zod";

const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO calendar date (YYYY-MM-DD)")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, "Use a real calendar date");

export const taskTrackerLlmItemSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    priority: z.enum(["urgent", "high", "medium", "low"]),
    scheduled_for: calendarDateSchema,
    due_on: calendarDateSchema.nullable(),
    estimate_minutes: z.number().int().positive().max(525600).nullable(),
    documentation_update: z.string().trim().min(1).max(20000),
    roadmap_description: z.string().trim().min(1).max(4000),
    roadmap_planning_prompt: z.string().trim().min(1).max(20000),
    roadmap_implementation_prompt: z.string().trim().min(1).max(20000),
    roadmap_validation_gate: z.string().trim().min(1).max(20000),
  })
  .strict()
  .refine(
    (item) => item.due_on === null || item.due_on >= item.scheduled_for,
    { message: "due_on cannot be before scheduled_for", path: ["due_on"] },
  );

export const taskTrackerLlmOutputSchema = z
  .object({
    tasks: z.array(taskTrackerLlmItemSchema).min(1).max(12),
  })
  .strict();

export const createTaskTrackerItemsSchema = z
  .object({
    input: z.string().trim().min(3).max(4000),
    time_zone: z.string().trim().min(1).max(100).default("UTC"),
  })
  .strict();

export const actionTaskTrackerItemSchema = z
  .object({
    expected_lock_version: z.number().int().positive(),
  })
  .strict();

const mutationFields = {
  expected_lock_version: z.number().int().positive(),
  scheduled_for: calendarDateSchema,
  due_on: calendarDateSchema.nullable(),
};

export const updateTaskTrackerItemSchema = z
  .discriminatedUnion("operation", [
    z
      .object({
        operation: z.literal("edit"),
        ...mutationFields,
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(4000),
        priority: z.enum(["urgent", "high", "medium", "low"]),
        estimate_minutes: z.number().int().positive().max(525600).nullable(),
      })
      .strict(),
    z
      .object({
        operation: z.literal("reschedule"),
        ...mutationFields,
      })
      .strict(),
    z
      .object({
        operation: z.literal("complete"),
        expected_lock_version: z.number().int().positive(),
      })
      .strict(),
  ])
  .refine(
    (input) =>
      input.operation === "complete" ||
      input.due_on === null ||
      input.due_on >= input.scheduled_for,
    { message: "due_on cannot be before scheduled_for", path: ["due_on"] },
  );

export const deleteTaskTrackerItemSchema = z
  .object({
    expected_lock_version: z.number().int().positive(),
  })
  .strict();

export type TaskTrackerLlmItem = z.infer<typeof taskTrackerLlmItemSchema>;
export type TaskTrackerLlmOutput = z.infer<typeof taskTrackerLlmOutputSchema>;
export type UpdateTaskTrackerItemInput = z.infer<
  typeof updateTaskTrackerItemSchema
>;
