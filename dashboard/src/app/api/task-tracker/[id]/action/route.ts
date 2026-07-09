import { NextResponse } from "next/server";
import { z } from "zod";
import { actionTaskTrackerItem } from "@/lib/task-tracker-actions";
import { actionTaskTrackerItemSchema } from "@/lib/task-tracker-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { ok: false, error: "Invalid task id." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const input = actionTaskTrackerItemSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json(
      { ok: false, error: "A valid task version is required." },
      { status: 400 },
    );
  }

  const result = await actionTaskTrackerItem(
    id,
    input.data.expected_lock_version,
  );
  if (!result.ok) {
    const status =
      result.code === "not_configured"
        ? 503
        : result.code === "not_found"
          ? 404
          : result.code === "conflict"
            ? 409
            : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
