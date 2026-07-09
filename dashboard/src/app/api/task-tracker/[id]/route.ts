import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteTaskTrackerItem,
  updateTaskTrackerItem,
} from "@/lib/task-tracker-mutations";
import {
  deleteTaskTrackerItemSchema,
  updateTaskTrackerItemSchema,
} from "@/lib/task-tracker-validation";
import { requireApiUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function itemId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

function errorStatus(code: string): number {
  if (code === "not_configured") return 503;
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  return 422;
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const id = await itemId(context);
  if (!id) {
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
  const parsed = updateTaskTrackerItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid task update.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateTaskTrackerItem(id, parsed.data);
  return NextResponse.json(result, {
    status: result.ok ? 200 : errorStatus(result.code),
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const id = await itemId(context);
  if (!id) {
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
  const parsed = deleteTaskTrackerItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "A valid task version is required." },
      { status: 400 },
    );
  }

  const result = await deleteTaskTrackerItem(
    id,
    parsed.data.expected_lock_version,
  );
  return NextResponse.json(result, {
    status: result.ok ? 200 : errorStatus(result.code),
  });
}
