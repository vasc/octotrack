import type { HomeView } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import type { Entry } from "../../lib/forYou.ts";
import { branchOfText } from "../../lib/lines.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { LineProposalCard } from "../home/LineProposalCard.tsx";
import { LineStepIn } from "../home/LineStepIn.tsx";
import { TaskItem } from "../home/TaskItem.tsx";
import { Focusable } from "../ui/Focusable.tsx";
import { ProposalItem } from "./ProposalItem.tsx";

/**
 * What the open entry holds, by its kind, with its own moves: a question's answers, a task's outcome, a proposal's
 * moves, a line's case for done or new done when, or Step in. Its numbered choices answer to the keys while it is open.
 */
export function ForYouEntry({
  entry,
  home,
  h,
  armed,
  onPutOff,
  onStarting,
}: {
  entry: Entry;
  home: HomeView;
  h: HomeActions;
  /** Its keys act: not while its choice waits with Undo, nor under a peek or a sheet. */
  armed: boolean;
  onPutOff(ref: string): void;
  /** A tabled line back to look at starts through the Start sheet, since it may hold questions and tasks. */
  onStarting(ref: string): void;
}) {
  const { item, line } = entry;
  switch (item.kind) {
    case "question":
      return <DecisionCardItem card={item.card} active armed={armed} onPostponed={onPutOff} />;
    case "stepin":
      return line === null ? null : (
        <LineStepIn
          line={line}
          reason={item.reason}
          kind={item.stepKind}
          focused
          folded={false}
          h={h}
          onFocus={() => undefined}
        />
      );
    case "proposal":
      return line === null ? null : (
        <Focusable focusRef={entry.ref} label={`Proposed line ${line.title}`} focused>
          <ProposalItem
            line={line}
            foldTargets={[...home.working, ...home.upNext]}
            lastUpNext={home.upNext.at(-1)?.title ?? null}
            origin={branchOfText(home.lines[line.ref])}
            busy={h.held.has(line.ref)}
            onStart={line.tabledReason === null ? h.start : onStarting}
            onQueue={h.queue}
            onTable={h.table}
            onFold={h.fold}
            onReject={h.reject}
            onDrop={h.drop}
          />
        </Focusable>
      );
    case "task":
      return (
        <Focusable focusRef={entry.ref} label={`Task ${item.task.ref}, ${item.task.title}`} focused>
          <TaskItem task={item.task} frees={item.frees} onDone={h.taskDone} onCant={h.taskCant} />
        </Focusable>
      );
    case "done":
    case "done_when":
      return line === null ? null : (
        <Focusable
          focusRef={entry.ref}
          label={item.kind === "done" ? `Proposed as done: ${line.title}` : `A new done when: ${line.title}`}
          focused
        >
          <LineProposalCard
            proposal={item}
            title={line.title}
            onAccept={() => (item.kind === "done" ? h.lineDone(line.ref) : h.doneWhen(line.ref, true))}
            onDecline={(why) =>
              item.kind === "done" ? h.notYet(line.ref, why) : h.doneWhen(line.ref, false)
            }
          />
        </Focusable>
      );
  }
}
