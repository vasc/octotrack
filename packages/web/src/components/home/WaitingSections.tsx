import type { HomeView, Line } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { foldedNames, heldOnTabled } from "../../lib/lines.ts";
import { Fold } from "../ui/Fold.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState } from "../ui/states.tsx";
import { ProposalCard } from "./ProposalCard.tsx";
import { ProposalGroups } from "./ProposalGroups.tsx";
import { QuietRow } from "./QuietRow.tsx";
import { StartSheet } from "./StartSheet.tsx";
import { UpNextRow } from "./UpNextRow.tsx";

/**
 * The lines not being worked on: up next in order, proposals, tabled and done lately. Starting one that waited opens
 * its Start sheet, which shows what it holds.
 */
export function WaitingSections({
  home,
  h,
  focus,
  starting,
  narrow = false,
  phone = false,
  handle,
  drop,
  onStarting,
  sheetArmed = true,
  firstRun = false,
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  /** The waiting line whose Start sheet is open. */
  starting: string | null;
  /** On a phone, or at a place, up next and proposals fold too. */
  narrow?: boolean;
  /** On a phone a fold names nothing, for want of room: the name and the count. */
  phone?: boolean;
  /** A line's number, which drags it or opens its moves. */
  handle(
    title: string,
    ref: string,
    index: number,
    count: number,
    section: "working" | "up_next",
    number?: number,
  ): ReactNode;
  drop(ref: string, section: "working" | "up_next"): DropTarget;
  onStarting(ref: string | null): void;
  /** Whether an open Start sheet's number keys act: not while a panel is open over home. */
  sheetArmed?: boolean;
  /** Nothing is placed yet: proposals are grouped by what their agents recommend. */
  firstRun?: boolean;
}) {
  const startingLine = [...home.upNext, ...home.tabled, ...home.proposed].find(
    (line) => line.ref === starting,
  );
  const named = (titles: readonly string[], note?: string | null) =>
    phone || titles.length === 0
      ? undefined
      : `${foldedNames(titles)}${note === undefined || note === null ? "" : ` · ${note}`}`;
  const upNext = (
    <List>
      {home.upNext.map((line, index) => {
        const details = home.lines[line.ref];
        const crew = home.crews[line.ref];
        return (
          <UpNextRow
            key={line.ref}
            notMoved={h.notMoved === line.ref}
            line={line}
            {...(crew === undefined ? {} : { crew })}
            {...(details === undefined ? {} : { details })}
            handle={handle(
              line.title,
              line.ref,
              index,
              home.upNext.length,
              "up_next",
              home.working.length + index + 1,
            )}
            focused={focus === lineFocusRef(line.ref)}
            drop={drop(line.ref, "up_next")}
            onStart={onStarting}
          />
        );
      })}
    </List>
  );
  const card = (line: Line) => (
    <ProposalCard
      key={line.ref}
      line={line}
      focused={focus === line.ref}
      foldTargets={[...home.working, ...home.upNext]}
      repoKeys={line.repos}
      lastUpNext={home.upNext.at(-1)?.title ?? null}
      // A line back from tabled may hold questions and tasks, so it starts through its Start sheet.
      onStart={line.tabledReason === null ? h.start : onStarting}
      onQueue={h.queue}
      onTable={h.table}
      onFold={h.fold}
      onReject={h.reject}
      onDrop={h.drop}
    />
  );
  const proposals = <List>{home.proposed.map(card)}</List>;
  const proposalsHeld = home.proposed.some((line) => line.ref === focus);
  const upNextHeld = home.upNext.some((line) => focus === lineFocusRef(line.ref));
  return (
    <>
      {narrow ? (
        <>
          {home.upNext.length === 0 ? null : (
            <Fold
              title="Up next"
              count={home.upNext.length}
              summary={named(home.upNext.map((line) => line.title))}
              held={upNextHeld}
            >
              {upNext}
            </Fold>
          )}
          {home.proposed.length === 0 ? null : (
            <Fold
              title="Proposed"
              count={home.proposed.length}
              summary={named(home.proposed.map((line) => line.title))}
              held={proposalsHeld}
            >
              {proposals}
            </Fold>
          )}
        </>
      ) : (
        <>
          {firstRun ? null : (
            <Section title="Up next" count={home.upNext.length}>
              {home.upNext.length === 0 ? <EmptyState>Nothing is up next</EmptyState> : upNext}
            </Section>
          )}
          {home.proposed.length === 0 ? null : firstRun ? (
            <ProposalGroups proposals={home.proposed} card={card} />
          ) : (
            <Section title="Proposed" count={home.proposed.length}>
              {proposals}
            </Section>
          )}
        </>
      )}
      {home.tabled.length === 0 ? null : (
        <Fold
          title="Tabled"
          count={home.tabled.length}
          summary={named(
            home.tabled.map((line) => line.title),
            heldOnTabled(home),
          )}
        >
          <List>
            {home.tabled.map((line) => (
              <QuietRow key={line.ref} line={line} onStart={onStarting} onQueue={h.queue} />
            ))}
          </List>
        </Fold>
      )}
      {home.doneLately.length === 0 ? null : (
        <Fold
          title="Done lately"
          count={home.doneLately.length}
          summary={named(home.doneLately.map((line) => line.title))}
        >
          <List>
            {home.doneLately.map((line) => (
              <QuietRow key={line.ref} line={line} />
            ))}
          </List>
        </Fold>
      )}
      {startingLine === undefined ? null : (
        <StartSheet
          line={startingLine}
          onDoneWhen={h.doneWhen}
          onStart={(started) => {
            h.start(started);
            onStarting(null);
          }}
          onCancel={() => onStarting(null)}
          armed={sheetArmed}
        />
      )}
    </>
  );
}
