import { SushicodeWorkspace } from "@/components/SushicodeWorkspace";
import { loadDashboardBundle } from "@/lib/data";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadRoadmapBundle } from "@/lib/roadmap";
import { loadTaskTrackerBundle } from "@/lib/task-tracker";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const bundle = await loadDashboardBundle();
  const [documentationNodes, taskTracker, roadmapBundle] = await Promise.all([
    loadDocumentationNodes(bundle.project.id).catch(() => []),
    loadTaskTrackerBundle().catch(() => ({ items: [] })),
    loadRoadmapBundle(),
  ]);

  return (
    <SushicodeWorkspace
      bundle={bundle}
      documentationNodes={documentationNodes}
      roadmapBundle={roadmapBundle}
      taskTrackerItems={taskTracker.items}
    />
  );
}
