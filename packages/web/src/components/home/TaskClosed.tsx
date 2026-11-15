import type { Issue } from "@octotrack/core/schemas";
import { sinceText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";

/** A task that has closed, opened again: what it was, how it closed and when, and what was sent back or why not. */
export function TaskClosed({ task }: { task: Issue }) {
  const done = task.status === "done";
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </p>
      <h3 className="question-title">{task.title}</h3>
      <section className="task-form" aria-label="How it closed">
        <span className="panel-label">
          {done ? "Done" : "Could not be done"}
          {task.closedAt === null ? "" : ` ${sinceText(task.closedAt)}`}
        </span>
        {task.result === null || task.result === "" ? null : <Markdown text={task.result} />}
      </section>
    </article>
  );
}
