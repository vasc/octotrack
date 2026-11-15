import type { Issue } from "@octotrack/core/schemas";
import { sinceText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";

/**
 * A task that has closed, opened again: what it was, how it closed and when (done, could not be done, or withdrawn by
 * its agent), and what was sent back or why not.
 */
export function TaskClosed({
  task,
  closed,
}: {
  task: Issue;
  /** How it closed and who closed it, where its history says; else from its status. */
  closed: { how: "done" | "cant" | "withdrawn"; by: string } | null;
}) {
  const how = closed?.how ?? (task.status === "done" ? "done" : "cant");
  const said =
    how === "done"
      ? "Done"
      : how === "cant"
        ? "Could not be done"
        : `Withdrawn by ${closed?.by ?? "its agent"}`;
  // A task of the developer's own sends nothing back: its result is only the word Done.
  const sent = task.outcome === "" || task.result === null || task.result === "" ? null : task.result;
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </p>
      <h3 className="question-title">{task.title}</h3>
      <section className="task-form" aria-label="How it closed">
        <span className="panel-label">
          {said}
          {task.closedAt === null ? "" : ` ${sinceText(task.closedAt)}`}
        </span>
        {sent === null ? null : <Markdown text={sent} />}
      </section>
    </article>
  );
}
