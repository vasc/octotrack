import type { HomeView } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { focusLabel } from "../../lib/focus.ts";
import type { Entry } from "../../lib/forYou.ts";
import { branchOfText } from "../../lib/lines.ts";
import { ForYouItem } from "../home/ForYouItem.tsx";
import { LineStepIn } from "../home/LineStepIn.tsx";
import { Focusable } from "../ui/Focusable.tsx";
import { ProposalItem } from "./ProposalItem.tsx";

/**
 * What the open entry holds, by its kind, with its own moves: a question's answers, a task's outcome, a line's case for
 * done or new done when, a proposal's moves, or Step in. Its numbered choices answer to the keys while it is open. A
 * choice made here waits with Undo in the bar at the foot, and the list moves on to the next entry meanwhile, as Later
 * does.
 */
export function ForYouEntry({
  entry,
  home,
  h,
  armed,
  onMoveOn,
  onStarting,
}: {
  entry: Entry;
  home: HomeView;
  h: HomeActions;
  /** Its keys act: not while its choice waits with Undo, nor under a peek or a sheet. */
  armed: boolean;
  /** A choice was made, or it was put off: open the next entry. */
  onMoveOn(ref: string): void;
  /** A tabled line back to look at starts through the Start sheet, since it may hold questions and tasks. */
  onStarting(ref: string): void;
}) {
  const { item, line } = entry;
  const moving =
    <A extends unknown[]>(act: (...args: A) => void) =>
    (...args: A) => {
      act(...args);
      onMoveOn(entry.ref);
    };
  switch (item.kind) {
    case "stepin":
      return line === null ? null : (
        <LineStepIn
          line={line}
          reason={item.reason}
          kind={item.stepKind}
          focused
          h={{
            ...h,
            own: moving(h.own),
            table: moving(h.table),
            retry: moving(h.retry),
            anyway: moving(h.anyway),
          }}
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
            onStart={line.tabledReason === null ? moving(h.start) : onStarting}
            onQueue={moving(h.queue)}
            onTable={moving(h.table)}
            onFold={moving(h.fold)}
            onReject={moving(h.reject)}
            onDrop={moving(h.drop)}
          />
        </Focusable>
      );
    case "question":
    case "task":
    case "done":
    case "done_when": {
      const opened = (
        <ForYouItem
          item={item}
          title={line?.title ?? ""}
          armed={armed}
          onTaskDone={moving(h.taskDone)}
          onTaskCant={moving(h.taskCant)}
          onLineDone={moving(h.lineDone)}
          onNotYet={moving(h.notYet)}
          onDoneWhen={moving(h.doneWhen)}
          onPostponed={onMoveOn}
          onAnswered={onMoveOn}
          lineNamed={line !== null}
        />
      );
      // A question numbers its own answers; anything else is pressed by number through its focus ref.
      return item.kind === "question" ? (
        opened
      ) : (
        <Focusable focusRef={entry.ref} label={focusLabel(item, line?.title ?? "")} focused>
          {opened}
        </Focusable>
      );
    }
  }
}
