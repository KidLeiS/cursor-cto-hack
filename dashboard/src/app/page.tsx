import { SushicodeWorkspace } from "@/components/SushicodeWorkspace";
import { loadDashboardBundle } from "@/lib/data";
import { loadDocumentationNodes } from "@/lib/documentation";
import { loadTaskTrackerBundle } from "@/lib/task-tracker";

export default async function HomePage() {
  const bundle = await loadDashboardBundle();
  const [documentationNodes, taskTracker] = await Promise.all([
    loadDocumentationNodes(bundle.project.id).catch(() => []),
    loadTaskTrackerBundle().catch(() => ({ items: [] })),
  ]);

  return (
    <SushicodeWorkspace
      bundle={bundle}
      documentationNodes={documentationNodes}
      taskTrackerItems={taskTracker.items}
    />
  );
}
