import type { Issue } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
import { TaskCard } from "./TaskCard.tsx";

/** A task opened, with what is typed kept as a draft. */
export function TaskItem({
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
