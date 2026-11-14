import type { Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { NotKept } from "../ui/NotKept.tsx";
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
  const why = useDraft(`task-why:${task.ref}`);
  const { waiting } = useChoices();
  return (
    <>
      <TaskCard
        task={task}
        words={draft.value}
        onWords={(words) => (words === "" ? draft.clear() : draft.change(words))}
        why={why.value}
        onWhy={(words) => (words === "" ? why.clear() : why.change(words))}
        sending={waiting(task.ref)}
        // Kept first: a save landing after the task closed would bring a deleted draft back.
        onDone={(result) => void draft.flush().then(() => onDone(task.ref, result))}
        onCant={(reason) => void why.flush().then(() => onCant(task.ref, reason))}
      />
      <NotKept error={draft.error ?? why.error} />
    </>
  );
}
