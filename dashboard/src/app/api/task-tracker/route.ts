import { NextResponse } from "next/server";
import {
  DeepSeekTaskParserError,
  parseTasksWithDeepSeek,
} from "@/lib/deepseek-task-parser";
import {
  createTaskTrackerItems,
  loadTaskTrackerBundle,
} from "@/lib/task-tracker";
import { createTaskTrackerItemsSchema } from "@/lib/task-tracker-validation";
import { requireApiUser } from "@/lib/auth";

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  try {
    const bundle = await loadTaskTrackerBundle();
    return NextResponse.json({
      ok: true,
      data: bundle.items,
      source: bundle.source,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "The task tracker could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const input = createTaskTrackerItemsSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Describe the tasks in 3–4000 characters.",
        issues: input.error.issues,
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = await parseTasksWithDeepSeek(input.data.input, {
      timeZone: input.data.time_zone,
    });
  } catch (error) {
    if (error instanceof DeepSeekTaskParserError) {
      const status =
        error.code === "not_configured"
          ? 503
          : error.code === "provider"
            ? 502
            : 422;
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "The task request could not be parsed." },
      { status: 500 },
    );
  }

  const result = await createTaskTrackerItems(input.data.input, parsed.tasks);
  if (!result.ok) {
    const status =
      result.code === "not_configured"
        ? 503
        : result.code === "not_found"
          ? 404
          : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(
    { ok: true, data: result.data },
    { status: 201 },
  );
}
