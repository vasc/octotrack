import type { TaskOutcome } from "../../lib/tasks.ts";
import type { ForYou } from "@octotrack/core/schemas";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { LineProposalCard } from "./LineProposalCard.tsx";
import { TaskItem } from "./TaskItem.tsx";

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
  onPostponed,
  background = false,
}: {
  item: ForYou;
  /** The line's title, for proposals about the line itself. */
  title: string;
  focused: boolean;
  /** Whether its keys act: not while its answer waits with Undo. */
  armed: boolean;
  onOpen(ref: string): void;
  onTaskDone(ref: string, outcome: TaskOutcome): void;
  onTaskCant(ref: string, why: string): void;
  onLineDone(line: string): void;
  onNotYet(line: string, why: string): void;
  onDoneWhen(line: string, accept: boolean): void;
  onPostponed?: (ref: string) => void;
  /** In a line's panel: a question offers its background, opened on its own. */
  background?: boolean;
}) {
  if (!focused) return <ForYouRow item={item} onOpen={onOpen} />;
  switch (item.kind) {
    case "question":
      return (
        <DecisionCardItem
          card={item.card}
          active
          armed={armed}
          background={background}
          {...(onPostponed === undefined ? {} : { onPostponed })}
        />
      );
    case "task":
      return <TaskItem task={item.task} onDone={onTaskDone} onCant={onTaskCant} />;
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
