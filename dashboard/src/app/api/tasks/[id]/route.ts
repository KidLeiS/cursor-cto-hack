import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteRoadmapTask,
  updateRoadmapTask,
} from "@/lib/roadmap-actions";
import {
  estimatedRemainingMinutes,
  loadRoadmapBundle,
  taskGraphFor,
} from "@/lib/roadmap";
import {
  deleteRoadmapTaskSchema,
  updateRoadmapTaskSchema,
} from "@/lib/roadmap-validation";
import { requireApiUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function taskIdFrom(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const taskId = await taskIdFrom(context);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const bundle = await loadRoadmapBundle();
  const graph = taskGraphFor(bundle, taskId);
  if (!graph) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      ...graph,
      root: {
        ...graph.root,
        estimated_remaining_minutes: estimatedRemainingMinutes(graph.root),
      },
      tasks: graph.tasks.map((task) => ({
        ...task,
        estimated_remaining_minutes: estimatedRemainingMinutes(task),
      })),
    },
    source: bundle.source,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const taskId = await taskIdFrom(context);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = updateRoadmapTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await updateRoadmapTask(taskId, parsed.data);
  if (!result.ok) {
    const status =
      result.code === "not_configured"
        ? 503
        : result.code === "conflict"
          ? 409
          : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({ data: result.data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  const taskId = await taskIdFrom(context);
  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = deleteRoadmapTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid delete request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await deleteRoadmapTask(
    taskId,
    parsed.data.expected_lock_version,
  );
  if (!result.ok) {
    const status =
      result.code === "not_configured"
        ? 503
        : result.code === "conflict"
          ? 409
          : 422;
    return NextResponse.json(result, { status });
  }
  return new NextResponse(null, { status: 204 });
}
