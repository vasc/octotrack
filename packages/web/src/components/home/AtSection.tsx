import type { AtView } from "@octotrack/core/schemas";
import { TaskItem } from "./TaskItem.tsx";

/** I'm at a place: every task for it, each with its choices, until the developer leaves or it ends by itself. */
export function AtSection({
  at,
  onLeave,
  onTaskDone,
  onTaskCant,
}: {
  at: AtView;
  onLeave(): void;
  onTaskDone(ref: string, result: string): void;
  onTaskCant(ref: string, why: string): void;
}) {
  return (
    <section className="home-section" aria-label={`At ${at.place}`}>
      <div className="section-head">
        <h2 className="section-title">
          At {at.place} <small>until {at.until.slice(11, 16)}</small>
        </h2>
        <button type="button" className="btn" onClick={onLeave}>
          Leave
        </button>
      </div>
      {at.tasks.length === 0 ? <p className="muted">Nothing to do here.</p> : null}
      <div className="home-items">
        {at.tasks.map((task) => (
          <TaskItem key={task.ref} task={task} onDone={onTaskDone} onCant={onTaskCant} />
        ))}
      </div>
    </section>
  );
}
