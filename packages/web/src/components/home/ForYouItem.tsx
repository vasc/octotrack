import type { TaskOutcome } from "../../lib/tasks.ts";
import type { ForYou, Issue } from "@octotrack/core/schemas";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { LineProposalCard } from "./LineProposalCard.tsx";
import { TaskItem } from "./TaskItem.tsx";

/** One thing waiting on the developer, opened in full: a question, a task, or a proposal about its line. */
export function ForYouItem({
  item,
  title,
  armed,
  onTaskDone,
  onTaskCant,
  onLineDone,
  onNotYet,
  onDoneWhen,
  onPostponed,
  onAnswered,
}: {
  item: ForYou;
  /** The line's title, for proposals about the line itself. */
  title: string;
  /** Whether its keys act: not while its answer waits with Undo. */
  armed: boolean;
  onTaskDone(task: Issue, outcome: TaskOutcome): void;
  onTaskCant(task: Issue, why: string): void;
  onLineDone(line: string): void;
  onNotYet(line: string, why: string): void;
  onDoneWhen(line: string, accept: boolean): void;
  onPostponed?: (ref: string) => void;
  /** A question answered: the page may move on while the answer waits with Undo. */
  onAnswered?: (ref: string) => void;
}) {
  switch (item.kind) {
    case "question":
      return (
        <DecisionCardItem
          card={item.card}
          active
          armed={armed}
          {...(onPostponed === undefined ? {} : { onPostponed })}
          {...(onAnswered === undefined ? {} : { onAnswered })}
        />
      );
    case "task":
      return <TaskItem task={item.task} frees={item.frees} onDone={onTaskDone} onCant={onTaskCant} />;
    case "done":
      return (
        <LineProposalCard
          proposal={item}
          title={title}
          onAccept={() => onLineDone(item.line)}
          onDecline={(why) => onNotYet(item.line, why)}
        />
      );
    case "done_when":
      return (
        <LineProposalCard
          proposal={item}
          title={title}
          onAccept={() => onDoneWhen(item.line, true)}
          onDecline={() => onDoneWhen(item.line, false)}
        />
      );
  }
}
