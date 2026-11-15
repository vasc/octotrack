import type { TaskOutcome } from "../../lib/tasks.ts";
import type { Issue, Line } from "@octotrack/core/schemas";
import { askedText } from "../../lib/tasks.ts";
import { FocusTarget } from "./FocusTarget.tsx";
import { TaskItem } from "./TaskItem.tsx";

/**
 * While you're here, from lines up next: tasks for this place that wait on lines not started yet, each with its
 * choices, saying which line and how long it has waited. Only current ones reach here.
 */
export function AtUpNext({
  tasks,
  lines,
  firstNumber,
  focus,
  onTaskDone,
  onTaskCant,
}: {
  tasks: readonly Issue[];
  /** Up next, in order, to name each task's line and its number. */
  lines: readonly Line[];
  /** The number of the first up-next line on the list. */
  firstNumber: number;
  focus: string | null;
  onTaskDone(task: Issue, outcome: TaskOutcome): void;
  onTaskCant(task: Issue, why: string): void;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="home-section" aria-label="While you're here, from lines up next">
      <h2 className="panel-label">While you're here, from lines up next</h2>
      <div className="line-items" data-flush="true">
        {tasks.map((task) => {
          const at = lines.findIndex((line) => line.ref === task.line);
          const line = lines[at];
          return (
            <FocusTarget key={task.ref} focusRef={task.ref} focused={task.ref === focus}>
              <p className="muted">
                {line === undefined ? "" : `${firstNumber + at} ${line.title}, up next · `}
                {task.ref} · {askedText(task)}
              </p>
              <TaskItem task={task} onDone={onTaskDone} onCant={onTaskCant} />
            </FocusTarget>
          );
        })}
      </div>
    </section>
  );
}
