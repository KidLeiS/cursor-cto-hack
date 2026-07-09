import { SushicodeWorkspace } from "@/components/SushicodeWorkspace";
import { loadDashboardBundle } from "@/lib/data";
import { loadDocumentationNodes } from "@/lib/documentation";

export default async function HomePage() {
  const bundle = await loadDashboardBundle();
  const documentationNodes = await loadDocumentationNodes(bundle.project.id).catch(() => []);

  return <SushicodeWorkspace bundle={bundle} documentationNodes={documentationNodes} />;
}
