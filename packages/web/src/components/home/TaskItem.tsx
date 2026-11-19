import { contracts } from "@octotrack/core/contracts";
import type { Issue } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useDraft } from "../../hooks/useDraft.ts";
import { useOutcomeDraft } from "../../hooks/useOutcomeDraft.ts";
import { usePlanStep } from "../../hooks/usePlanStep.ts";
import type { TaskOutcome } from "../../lib/tasks.ts";
import { NotKept } from "../ui/NotKept.tsx";
import { TaskCard } from "./TaskCard.tsx";

/**
 * A task opened, with what is typed kept as a draft. A reply goes to the agent waiting on it after Undo's few seconds,
 * as Tell does, and its draft is cleared only once it has gone.
 */
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
  const step = usePlanStep(task.line, task.step);
  // As the strip reads it: "holds up step 3, settle the enclosure".
  const holdsUp = step === null ? null : `step ${step.address}, ${step.title}`;
  const why = useDraft(`task-why:${task.ref}`);
  const replyKey = `task-reply:${task.ref}`;
  const reply = useDraft(replyKey);
  const choices = useChoices();
  const { waiting } = choices;
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
        reply={reply.value}
        onReplyWords={(words) => (words === "" ? reply.clear() : reply.change(words))}
        onReply={(words) =>
          void reply
            .flush()
            .then(() =>
              choices.make(
                contracts.taskReply.name,
                { ref: task.ref, body: words },
                `Replying on ${task.title}: ${words}`,
                replyKey,
              ),
            )
        }
        sending={waiting(task.ref)}
        // Kept first: a save landing after the task closed would bring a deleted draft back.
        onDone={(outcome) => void draft.flush().then(() => onDone(task, outcome))}
        onCant={(reason) => void why.flush().then(() => onCant(task, reason))}
      />
      <NotKept unsaved={(draft.error ?? why.error ?? reply.error) !== null} />
    </>
  );
}
