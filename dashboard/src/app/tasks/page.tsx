import Link from "next/link";
import { TaskList } from "@/components/TaskList";
import { buildRoadmapTree, loadRoadmapBundle } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const bundle = await loadRoadmapBundle();
  const tree = buildRoadmapTree(bundle.tasks);

  return (
    <main>
      <header className="hero">
        <div className="eyebrow">
          <Link href="/">sushicode</Link> / roadmap
        </div>
        <h1 className="brand">Roadmap tasks</h1>
        <p className="lede">
          A linear plan today, backed by dependency edges that can grow into a
          DAG. Estimates show effort remaining, not calendar deadlines.
        </p>
        <div className="meta">
          <span className="pill">
            <strong>{bundle.project.name}</strong>
          </span>
          <span className="pill">{bundle.source} data</span>
        </div>
      </header>
      <section>
        <h2>Current roadmap</h2>
        <p className="hint">
          Open a task to inspect its subtasks, exact prompts, and validation
          gates.
        </p>
        <TaskList tasks={tree.roots} />
      </section>
      {tree.orphaned.length > 0 ? (
        <section>
          <h2>Unattached tasks</h2>
          <TaskList tasks={tree.orphaned} />
        </section>
      ) : null}
    </main>
  );
}
