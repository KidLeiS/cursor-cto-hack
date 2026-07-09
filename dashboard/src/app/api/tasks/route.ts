import { NextResponse } from "next/server";
import { createRoadmapTask } from "@/lib/roadmap-actions";
import {
  buildRoadmapTree,
  estimatedRemainingMinutes,
  loadRoadmapBundle,
} from "@/lib/roadmap";
import { createRoadmapTaskSchema } from "@/lib/roadmap-validation";

export async function GET() {
  const bundle = await loadRoadmapBundle();
  const tree = buildRoadmapTree(bundle.tasks);
  const data = tree.roots.map((task) => ({
    ...task,
    estimated_remaining_minutes: estimatedRemainingMinutes(task),
    subtask_count: task.children.length,
    children: undefined,
  }));
  return NextResponse.json({ data, source: bundle.source });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = createRoadmapTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid task", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createRoadmapTask(parsed.data);
  if (!result.ok) {
    const status =
      result.code === "not_configured"
        ? 503
        : result.code === "not_found"
          ? 404
          : 422;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({ data: result.data }, { status: 201 });
}
