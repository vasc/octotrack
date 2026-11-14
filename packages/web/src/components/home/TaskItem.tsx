import type { Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useOutcomeDraft } from "../../hooks/useOutcomeDraft.ts";
import type { TaskOutcome } from "../../lib/tasks.ts";
import { NotKept } from "../ui/NotKept.tsx";
import { TaskCard } from "./TaskCard.tsx";

/** A task opened, with what is typed kept as a draft. */
export function TaskItem({
  task,
  onDone,
  onCant,
}: {
  task: Issue;
  onDone(ref: string, outcome: TaskOutcome): void;
  onCant(ref: string, why: string): void;
}) {
  const draft = useOutcomeDraft(task.ref);
  const why = useDraft(`task-why:${task.ref}`);
  const { waiting } = useChoices();
  return (
    <>
      <TaskCard
        task={task}
        words={draft.note}
        onWords={draft.setNote}
        values={draft.values}
        onValue={draft.setValue}
        why={why.value}
        onWhy={(words) => (words === "" ? why.clear() : why.change(words))}
        sending={waiting(task.ref)}
        // Kept first: a save landing after the task closed would bring a deleted draft back.
        onDone={(outcome) => void draft.flush().then(() => onDone(task.ref, outcome))}
        onCant={(reason) => void why.flush().then(() => onCant(task.ref, reason))}
      />
      <NotKept error={draft.error ?? why.error} />
    </>
  );
}
