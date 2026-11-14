import type { ForYou } from "@octotrack/core/schemas";
import { useState } from "react";
import type { HomeActions } from "../../hooks/useHome.ts";
import { refOf } from "../../lib/focus.ts";
import { ForYouItem } from "../home/ForYouItem.tsx";

function heading(items: readonly ForYou[]): string {
  const questions = items.filter((item) => item.kind === "question").length;
  const tasks = items.filter((item) => item.kind === "task").length;
  const proposals = items.length - questions - tasks;
  return [
    questions === 0 ? null : `${questions} question${questions === 1 ? "" : "s"}`,
    tasks === 0 ? null : `${tasks} task${tasks === 1 ? "" : "s"}`,
    proposals === 0 ? null : `${proposals} proposal${proposals === 1 ? "" : "s"}`,
  ]
    .filter((part) => part !== null)
    .join(", ");
}

/**
 * What the line needs from the developer, in the panel: the first opened and taking the keys, the rest one row each,
 * opened in its place on a click.
 */
export function PanelForYou({
  title,
  items,
  h,
}: {
  title: string;
  items: readonly ForYou[];
  h: HomeActions;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [first] = items;
  const focused = items.some((item) => refOf(item) === open)
    ? open
    : first === undefined
      ? null
      : refOf(first);
  if (items.length === 0) return null;
  return (
    <section className="panel-section" aria-label="For you">
      <h2 className="panel-label" data-tone="attention">
        For you · {heading(items)}
      </h2>
      {items.map((item) => (
        <ForYouItem
          key={refOf(item)}
          item={item}
          title={title}
          focused={refOf(item) === focused}
          armed={!h.held.has(refOf(item))}
          onOpen={setOpen}
          onTaskDone={h.taskDone}
          onTaskCant={h.taskCant}
          onLineDone={h.lineDone}
          onNotYet={h.notYet}
          onDoneWhen={h.doneWhen}
          background
        />
      ))}
    </section>
  );
}
