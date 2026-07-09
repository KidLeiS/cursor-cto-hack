import Link from "next/link";
import type { RoadmapTaskNode } from "@/lib/roadmap";
import {
  estimatedRemainingMinutes,
  formatMinutes,
} from "@/lib/roadmap";
import { TaskProgress } from "./TaskProgress";

export function TaskList({ tasks }: { tasks: RoadmapTaskNode[] }) {
  if (tasks.length === 0) {
    return <p className="empty">No roadmap tasks yet.</p>;
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article className="task-row" key={task.id}>
          <div className="row-title">
            <h3>
              <Link href={`/tasks/${task.id}`}>{task.title}</Link>
            </h3>
            <span className={`pill ${task.status}`}>{task.status}</span>
          </div>
          {task.description ? <p className="muted">{task.description}</p> : null}
          <TaskProgress value={task.progress_percent} />
          <div className="task-meta mono">
            <span>{task.children.length} subtasks</span>
            <span>
              {formatMinutes(estimatedRemainingMinutes(task))} remaining
            </span>
            <span>{formatMinutes(task.estimate_minutes)} total estimate</span>
          </div>
        </article>
      ))}
    </div>
  );
}
