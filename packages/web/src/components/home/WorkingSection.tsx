import type { HomeView } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import type { HomeActions } from "../../hooks/useHome.ts";
import { refOf, stepInRef } from "../../lib/focus.ts";
import { stepInReason } from "../../lib/lines.ts";
import { ForYouItem } from "./ForYouItem.tsx";
import { HomeSection } from "./HomeSection.tsx";
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
  reorder,
  onFocus,
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  armed: boolean;
  /** Lines from this index on fold to one row. */
  foldFrom: number;
  reorder(title: string, ref: string, index: number, count: number): ReactNode;
  onFocus(ref: string): void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return (
    <HomeSection title="Working on" count={home.working.length} note="your order is everyone's order">
      {home.working.length === 0 ? <p className="muted">Nothing is being worked on.</p> : null}
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
          <ForYouItem
            key={refOf(forYouItem)}
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
          />
        );
        return (
          <WorkingLine
            key={line.ref}
            index={index + 1}
            line={line}
            {...(crew === undefined ? {} : { crew })}
            {...(details === undefined ? {} : { details })}
            reorder={reorder(line.title, line.ref, index, home.working.length)}
          >
            {stepIn === null ? null : (
              <StepIn
                line={line}
                reason={stepIn}
                focused={focus === stepInRef(line.ref)}
                {...(failed && !cloneFailed ? { onRetry: h.retry } : {})}
                {...(atCap ? { onAnyway: h.anyway } : {})}
                {...(cloneFailed && repo !== undefined
                  ? { checkoutRepo: repo, onCheckout: h.setCheckout }
                  : {})}
                onOwn={h.own}
                onTable={h.table}
              />
            )}
            {first === undefined ? null : folded ? (
              <button type="button" className="chip" onClick={() => onFocus(refOf(first))}>
                {forYou.length} waiting on you
              </button>
            ) : (
              <div className="home-items">{item(first)}</div>
            )}
            {rest.length === 0 || folded ? null : open ? (
              <div className="home-items">{rest.map(item)}</div>
            ) : (
              <button
                type="button"
                className="chip"
                onClick={() => setExpanded(new Set([...expanded, line.ref]))}
              >
                +{rest.length} more for you
              </button>
            )}
          </WorkingLine>
        );
      })}
    </HomeSection>
  );
}
