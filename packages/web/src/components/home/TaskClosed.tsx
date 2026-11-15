import type { Issue } from "@octotrack/core/schemas";
import { sinceText } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Label } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";

/** A task that has closed: what it was, how and when it closed, and what was sent back. */
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
    <Item
      label={task.title}
      tone="none"
      kind={
        <Facts>
          Task
          <RefLink value={task.ref} />
          {task.place === null ? null : `at ${task.place}`}
        </Facts>
      }
      title={task.title}
    >
      <section aria-label="How it closed">
        <Label>
          {said}
          {task.closedAt === null ? "" : ` ${sinceText(task.closedAt)}`}
        </Label>
        {sent === null ? null : <Markdown text={sent} />}
      </section>
    </Item>
  );
}
