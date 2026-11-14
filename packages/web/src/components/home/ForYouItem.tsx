import type { ForYou, Issue } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
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
  return <TaskItem task={item.task} onDone={onTaskDone} onCant={onTaskCant} />;
}

/** A task opened, with what is typed kept as a draft. */
function TaskItem({
  task,
  onDone,
  onCant,
}: {
  task: Issue;
  onDone(ref: string, result: string): void;
  onCant(ref: string, why: string): void;
}) {
  const draft = useDraft(`task:${task.ref}`);
  return (
    <TaskCard
      task={task}
      words={draft.value}
      onWords={(words) => (words === "" ? draft.clear() : draft.change(words))}
      onDone={(result) => onDone(task.ref, result)}
      onCant={(why) => onCant(task.ref, why)}
    />
  );
}
