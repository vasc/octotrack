import type { Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useOutcomeDraft } from "../../hooks/useOutcomeDraft.ts";
import { usePlanStep } from "../../hooks/usePlanStep.ts";
import type { TaskOutcome } from "../../lib/tasks.ts";
import { NotKept } from "../ui/NotKept.tsx";
import { TaskCard } from "./TaskCard.tsx";

/** A task opened, with what is typed kept as a draft. */
export function TaskItem({
  task,
  frees = null,
  onDone,
  onCant,
}: {
  task: Issue;
  /** The issue its outcome frees, by ref and title, where home knows it. */
  frees?: { ref: string; title: string } | null;
  onDone(task: Issue, outcome: TaskOutcome): void;
  onCant(task: Issue, why: string): void;
}) {
  const draft = useOutcomeDraft(task.ref);
  const holdsUp = usePlanStep(task.line, task.step)?.title ?? null;
  const why = useDraft(`task-why:${task.ref}`);
  const { waiting } = useChoices();
  return (
    <>
      <TaskCard
        task={task}
        {...(holdsUp === null ? {} : { holdsUp })}
        frees={frees}
        words={draft.note}
        onWords={draft.setNote}
        values={draft.values}
        onValue={draft.setValue}
        why={why.value}
        onWhy={(words) => (words === "" ? why.clear() : why.change(words))}
        sending={waiting(task.ref)}
        // Kept first: a save landing after the task closed would bring a deleted draft back.
        onDone={(outcome) => void draft.flush().then(() => onDone(task, outcome))}
        onCant={(reason) => void why.flush().then(() => onCant(task, reason))}
      />
      <NotKept unsaved={(draft.error ?? why.error) !== null} />
    </>
  );
}
