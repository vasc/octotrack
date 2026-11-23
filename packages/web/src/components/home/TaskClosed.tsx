import type { Issue } from "@octotrack/core/schemas";
import { sinceText } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { Item, Kind } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { RefLink } from "../ui/RefLink.tsx";

/**
 * A task that has closed, read only: how it ended leading its small row, with who and when, then its title and what
 * was sent back; a task that could not be done says why in the same breath.
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
  const reason = task.result === null || task.result === "" ? null : task.result;
  const ended =
    how === "done"
      ? "Done"
      : how === "cant"
        ? `Could not be done${reason === null ? "" : `: ${reason}`}`
        : `Withdrawn by ${closed?.by ?? "its agent"}`;
  const by = closed === null ? null : closed.by === "dev" ? "you" : closed.by;
  const when = task.closedAt === null ? null : sinceText(task.closedAt);
  // A task of the developer's own sends nothing back: its result is only the word Done.
  const sent = how !== "done" || task.outcome === "" ? null : reason;
  return (
    <Item
      label={task.title}
      tone="none"
      kind={
        <Facts>
          <Kind tone="none">{ended}</Kind>
          <RefLink value={task.ref} />
          {how === "withdrawn" ? when : by === null ? when : `by ${by}${when === null ? "" : `, ${when}`}`}
        </Facts>
      }
      title={task.title}
    >
      {sent === null ? null : <Markdown text={sent} />}
    </Item>
  );
}
