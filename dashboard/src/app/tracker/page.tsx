import type { Metadata } from "next";
import { TaskTrackerWorkspace } from "@/components/task-tracker/TaskTrackerWorkspace";
import { loadTaskTrackerBundle } from "@/lib/task-tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Task tracker · sushicode",
  description: "Plan client work on a priority calendar and action it into delivery.",
};

export default async function TaskTrackerPage() {
  const bundle = await loadTaskTrackerBundle();
  return (
    <TaskTrackerWorkspace
      projectName={bundle.project.name}
      source={bundle.source}
      initialItems={bundle.items}
    />
  );
}
