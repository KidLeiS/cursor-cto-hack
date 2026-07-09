import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskDag } from "@/components/TaskDag";
import { TaskProgress } from "@/components/TaskProgress";
import {
  estimatedRemainingMinutes,
  formatMinutes,
  loadRoadmapBundle,
  taskGraphFor,
} from "@/lib/roadmap";
import type { RoadmapTask } from "@shared/types";

function TaskInstructions({ task }: { task: RoadmapTask }) {
  return (
    <article className="instruction-card" id={`task-${task.id}`}>
      <div className="row-title">
        <h3>{task.title}</h3>
        <span className={`pill ${task.status}`}>{task.status}</span>
      </div>
      <TaskProgress value={task.progress_percent} />
      <dl className="instruction-list">
        <div>
          <dt>Planning prompt</dt>
          <dd>{task.planning_prompt}</dd>
        </div>
        <div>
          <dt>Implementation prompt</dt>
          <dd>{task.implementation_prompt}</dd>
        </div>
        <div>
          <dt>Validation gate</dt>
          <dd>{task.validation_gate}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await loadRoadmapBundle();
  const graph = taskGraphFor(bundle, id);
  if (!graph) notFound();

  const remaining = estimatedRemainingMinutes(graph.root);
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">
          <Link href="/tasks">roadmap</Link> / {graph.root.slug}
        </div>
        <div className="row-title task-heading">
          <h1 className="brand">{graph.root.title}</h1>
          <span className={`pill ${graph.root.status}`}>
            {graph.root.status}
          </span>
        </div>
        {graph.root.description ? (
          <p className="lede">{graph.root.description}</p>
        ) : null}
        <TaskProgress value={graph.root.progress_percent} />
        <div className="meta">
          <span className="pill">
            <strong>{formatMinutes(remaining)}</strong> remaining
          </span>
          <span className="pill">
            <strong>{formatMinutes(graph.root.estimate_minutes)}</strong>{" "}
            estimated
          </span>
          <span className="pill">
            <strong>{graph.tasks.length}</strong> graph nodes
          </span>
        </div>
      </header>

      <section>
        <h2>Subtask DAG</h2>
        <p className="hint">
          Arrows run from prerequisite to dependent task. Pan or zoom to inspect
          the plan.
        </p>
        <TaskDag tasks={graph.tasks} dependencies={graph.dependencies} />
      </section>

      <section className="instructions-section">
        <h2>Prompts and validation gates</h2>
        <p className="hint">
          These strings are the executable contract for each graph node.
        </p>
        <div className="instruction-grid">
          {graph.tasks.map((task) => (
            <TaskInstructions task={task} key={task.id} />
          ))}
        </div>
      </section>

      {graph.tasks.every((task) => task.id !== graph.root.id) ? (
        <section className="instructions-section">
          <h2>Parent task contract</h2>
          <TaskInstructions task={graph.root} />
        </section>
      ) : null}
    </main>
  );
}
