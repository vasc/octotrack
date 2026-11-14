import type { HomeView } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import { lineFocusRef, refOf, stepInRef } from "../../lib/focus.ts";
import { stepInReason } from "../../lib/lines.ts";
import { FocusTarget } from "./FocusTarget.tsx";
import { FoldedItems } from "./FoldedItems.tsx";
import { TaskItem } from "./TaskItem.tsx";
import { ForYouItem } from "./ForYouItem.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { MoreForYou } from "./MoreForYou.tsx";
import { StepIn } from "./StepIn.tsx";
import { WorkingLine } from "./WorkingLine.tsx";

/** A clone that failed says so in its output: the fix is a checkout this machine already has. */
const CLONE_FAILED = /clone|checkout is set/i;

/**
 * Working on: each line with Step in first when it needs one, then the first thing waiting on the developer and the
 * rest one row away. On a phone past the second line, or while at a place, a line folds to one row saying how much
 * waits, unless one of its items has focus.
 */
export function WorkingSection({
  home,
  h,
  focus,
  armed,
  foldFrom,
  at,
  handle,
  drop,
  actions,
  onFocus,
  onPostponed,
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  armed: boolean;
  /** Lines from this index on fold to one row. */
  foldFrom: number;
  /** I'm at this place: its tasks open on their lines and everything else folds. */
  at: string | null;
  /** A line's handle, which drags it or opens its moves. */
  handle(title: string, ref: string, index: number, count: number, section: "working" | "up_next"): ReactNode;
  drop(ref: string, section: "working" | "up_next"): DropTarget;
  /** What acts on the whole section: Reorder. */
  actions: ReactNode;
  onFocus(ref: string): void;
  /** Later sent a question to the bottom of its line: focus moves on from it. */
  onPostponed(ref: string): void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return (
    <HomeSection
      title="Working on"
      count={home.working.length}
      note="Your order is everyone's order"
      actions={actions}
      main
    >
      {home.working.length === 0 ? <p className="muted">Nothing is being worked on.</p> : null}
      <ol className="line-list">
        {home.working.map((line, index) => {
          const details = home.lines[line.ref];
          const crew = home.crews[line.ref];
          const forYou = details?.forYou ?? [];
          const start = details?.start ?? null;
          // Whether to step in is the server's rule, shared with the phone's buzz.
          const stepIn = details?.stepIn === true ? stepInReason(line, home.runner, start) : null;
          const failed = start?.state === "failed" || start?.state === "never_took";
          const cloneFailed = failed && CLONE_FAILED.test(start?.output ?? "");
          const atCap = home.runner.configured && !home.runner.dryRun && !failed;
          const repo = line.repos[0];
          const [first, ...rest] = forYou;
          const open = expanded.has(line.ref) || rest.some((other) => refOf(other) === focus);
          const folded = index >= foldFrom && !forYou.some((other) => refOf(other) === focus);
          const item = (forYouItem: (typeof forYou)[number]) => (
            <FocusTarget
              key={refOf(forYouItem)}
              focusRef={refOf(forYouItem)}
              focused={refOf(forYouItem) === focus}
            >
              <ForYouItem
                item={forYouItem}
                title={line.title}
                focused={refOf(forYouItem) === focus}
                armed={armed}
                onOpen={onFocus}
                onTaskDone={h.taskDone}
                onTaskCant={h.taskCant}
                onLineDone={h.lineDone}
                onNotYet={h.notYet}
                onDoneWhen={h.doneWhen}
                onPostponed={onPostponed}
              />
            </FocusTarget>
          );
          return (
            <WorkingLine
              key={line.ref}
              focused={focus === lineFocusRef(line.ref)}
              drop={drop(line.ref, "working")}
              index={index + 1}
              line={line}
              {...(crew === undefined ? {} : { crew })}
              {...(details === undefined ? {} : { details })}
              handle={handle(line.title, line.ref, index, home.working.length, "working")}
            >
              {stepIn === null ? null : at !== null && focus !== stepInRef(line.ref) ? (
                <div className="line-items">
                  <button type="button" className="more-link" onClick={() => onFocus(stepInRef(line.ref))}>
                    Step in, folded
                  </button>
                </div>
              ) : (
                <div className="line-items">
                  <StepIn
                    line={line}
                    reason={stepIn}
                    focused={focus === stepInRef(line.ref)}
                    {...((failed && !cloneFailed) || !home.runner.configured ? { onRetry: h.retry } : {})}
                    {...(atCap ? { onAnyway: h.anyway } : {})}
                    {...(cloneFailed && repo !== undefined
                      ? { checkoutRepo: repo, onCheckout: h.setCheckout }
                      : {})}
                    onOwn={h.own}
                    onTable={h.table}
                  />
                </div>
              )}
              {at !== null ? (
                <div className="line-items">
                  {forYou.map((other) => {
                    const here = other.kind === "task" && other.task.place === at;
                    // This place's tasks open with their choices; anything else opens only with focus.
                    if (here)
                      return (
                        <FocusTarget
                          key={refOf(other)}
                          focusRef={refOf(other)}
                          focused={refOf(other) === focus}
                        >
                          <TaskItem task={other.task} onDone={h.taskDone} onCant={h.taskCant} />
                        </FocusTarget>
                      );
                    return refOf(other) === focus ? item(other) : null;
                  })}
                  <FoldedItems
                    items={forYou.filter(
                      (other) =>
                        !(other.kind === "task" && other.task.place === at) && refOf(other) !== focus,
                    )}
                    onOpen={() => {
                      const rest = forYou.find(
                        (other) =>
                          !(other.kind === "task" && other.task.place === at) && refOf(other) !== focus,
                      );
                      if (rest !== undefined) onFocus(refOf(rest));
                    }}
                  />
                </div>
              ) : first === undefined ? null : folded ? (
                <div className="line-items">
                  <button type="button" className="more-link" onClick={() => onFocus(refOf(first))}>
                    {forYou.length} waiting on you
                  </button>
                </div>
              ) : (
                <div className="line-items">
                  {item(first)}
                  {rest.length === 0 ? null : open ? (
                    rest.map(item)
                  ) : (
                    <MoreForYou items={rest} onShow={() => setExpanded(new Set([...expanded, line.ref]))} />
                  )}
                </div>
              )}
            </WorkingLine>
          );
        })}
      </ol>
    </HomeSection>
  );
}
