import type { ForYou, Issue } from "@octotrack/core/schemas";
import { useDraft } from "../../hooks/useDraft.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { LineProposalCard } from "./LineProposalCard.tsx";
import { TaskCard } from "./TaskCard.tsx";

/** One thing waiting on the developer: opened in full when it has focus, else one row that opens it. */
export function ForYouItem({
  item,
  title,
  focused,
  armed,
  onOpen,
  onTaskDone,
  onTaskCant,
  onLineDone,
  onNotYet,
  onDoneWhen,
}: {
  item: ForYou;
  /** The line's title, for proposals about the line itself. */
  title: string;
  focused: boolean;
  /** Whether its keys act: not while its answer waits with Undo. */
  armed: boolean;
  onOpen(ref: string): void;
  onTaskDone(ref: string, result: string): void;
  onTaskCant(ref: string, why: string): void;
  onLineDone(line: string): void;
  onNotYet(line: string, why: string): void;
  onDoneWhen(line: string, accept: boolean): void;
}) {
  if (!focused) return <ForYouRow item={item} onOpen={onOpen} />;
  switch (item.kind) {
    case "question":
      return <DecisionCardItem card={item.card} active armed={armed} />;
    case "task":
      return <TaskItem task={item.task} onDone={onTaskDone} onCant={onTaskCant} />;
    case "done":
      return (
        <LineProposalCard
          kind="done"
          line={item.line}
          title={title}
          text={item.text}
          by={item.by}
          onAccept={() => onLineDone(item.line)}
          onDecline={(why) => onNotYet(item.line, why)}
        />
      );
    case "done_when":
      return (
        <LineProposalCard
          kind="done_when"
          line={item.line}
          title={title}
          text={item.text}
          by={item.by}
          onAccept={() => onDoneWhen(item.line, true)}
          onDecline={() => onDoneWhen(item.line, false)}
        />
      );
  }
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
