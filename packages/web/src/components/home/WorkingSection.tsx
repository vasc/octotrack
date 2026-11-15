import type { ForYou, HomeView } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import { lineFocusRef, refOf, stepInRef } from "../../lib/focus.ts";
import { AtPlaceItems } from "./AtPlaceItems.tsx";
import { TaskItem } from "./TaskItem.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { LineForYou } from "./LineForYou.tsx";
import { LineForYouItem } from "./LineForYouItem.tsx";
import { LineStepIn } from "./LineStepIn.tsx";
import { WorkingLine } from "./WorkingLine.tsx";

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
  /** What sits in the section header: how thin the developer is spread. */
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
          const rest = forYou.slice(1);
          const open = expanded.has(line.ref) || rest.some((other) => refOf(other) === focus);
          const folded = index >= foldFrom && !forYou.some((other) => refOf(other) === focus);
          const item = (other: ForYou) => (
            <LineForYouItem
              key={refOf(other)}
              item={other}
              title={line.title}
              focus={focus}
              armed={armed}
              h={h}
              onFocus={onFocus}
              onPostponed={onPostponed}
            />
          );
          return (
            <WorkingLine
              key={line.ref}
              focused={focus === lineFocusRef(line.ref)}
              drop={drop(line.ref, "working")}
              fold={at !== null ? "at" : folded ? "phone" : null}
              index={index + 1}
              line={line}
              {...(crew === undefined ? {} : { crew })}
              {...(details === undefined ? {} : { details })}
              handle={handle(line.title, line.ref, index, home.working.length, "working")}
            >
              <LineStepIn
                line={line}
                reason={details?.stepInReason ?? null}
                kind={details?.stepInKind ?? null}
                focused={focus === stepInRef(line.ref)}
                folded={at !== null}
                h={h}
                onFocus={onFocus}
              />
              {at !== null ? (
                <AtPlaceItems
                  forYou={forYou}
                  at={at}
                  focus={focus}
                  task={(task) => <TaskItem task={task} onDone={h.taskDone} onCant={h.taskCant} />}
                  item={item}
                  onFocus={onFocus}
                />
              ) : (
                <LineForYou
                  forYou={forYou}
                  folded={folded}
                  open={open}
                  item={item}
                  onFocus={onFocus}
                  onShowMore={() => setExpanded(new Set([...expanded, line.ref]))}
                />
              )}
            </WorkingLine>
          );
        })}
      </ol>
    </HomeSection>
  );
}
