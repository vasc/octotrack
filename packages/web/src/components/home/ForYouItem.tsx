import type { ForYou } from "@octotrack/core/schemas";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { TaskCard } from "./TaskCard.tsx";

export function refOf(item: ForYou): string {
  return item.kind === "question" ? item.card.decision.ref : item.task.ref;
}

/** One thing waiting on the developer: opened in full when it has focus, else one row that opens it. */
export function ForYouItem({
  item,
  focused,
  onOpen,
  onTaskDone,
  onTaskCant,
}: {
  item: ForYou;
  focused: boolean;
  onOpen(ref: string): void;
  onTaskDone(ref: string, result: string): void;
  onTaskCant(ref: string, why: string): void;
}) {
  if (!focused) return <ForYouRow item={item} onOpen={onOpen} />;
  if (item.kind === "question") return <DecisionCardItem card={item.card} active />;
  return (
    <TaskCard
      task={item.task}
      onDone={(result) => onTaskDone(item.task.ref, result)}
      onCant={(why) => onTaskCant(item.task.ref, why)}
    />
  );
}
