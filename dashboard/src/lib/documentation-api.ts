import { NextResponse } from "next/server";
import { z } from "zod";

export const openApiHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: openApiHeaders });
}

export function apiOptions() {
  return new NextResponse(null, { status: 204, headers: openApiHeaders });
}

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: apiJson({ ok: false, error: "Request body must be JSON." }, 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: apiJson(
        {
          ok: false,
          error: "Request validation failed.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        422,
      ),
    };
  }
  return { data: parsed.data };
}

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const finite = z.number().finite();
const nullablePositive = z.number().positive().finite().nullable();

export const createNodeSchema = z.object({
  parent_id: z.uuid().nullable().optional(),
  slug,
  title: z.string().trim().min(1).max(160),
  markdown: z.string().max(2_000_000).optional(),
  sort_order: z.number().int().min(0).optional(),
  canvas_x: finite.optional(),
  canvas_y: finite.optional(),
});

export const updateNodeSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("content"),
    expected_lock_version: z.number().int().positive(),
    slug,
    title: z.string().trim().min(1).max(160),
    markdown: z.string().max(2_000_000),
  }),
  z.object({
    operation: z.literal("move"),
    expected_lock_version: z.number().int().positive(),
    parent_id: z.uuid().nullable(),
    sort_order: z.number().int().min(0),
    canvas_x: finite,
    canvas_y: finite,
    canvas_width: nullablePositive,
    canvas_height: nullablePositive,
    canvas_metadata: z.record(z.string(), z.unknown()),
  }),
  z.object({
    operation: z.literal("restore"),
    expected_lock_version: z.number().int().positive(),
    content_version: z.number().int().positive(),
  }),
]);

export function actionStatus(result: { ok: boolean; code?: string }): number {
  if (result.ok) return 200;
  if (result.code === "conflict") return 409;
  if (result.code === "invalid") return 422;
  if (result.code === "not_configured") return 503;
  return 400;
}
