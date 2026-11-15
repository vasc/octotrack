import type { HomeView } from "@octotrack/core/schemas";
import { Fragment, type ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { heldOnTabled } from "../../lib/lines.ts";
import { FoldedSection } from "./FoldedSection.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { ProposalCard } from "./ProposalCard.tsx";
import { QuietRow } from "./QuietRow.tsx";
import { StartSheet } from "./StartSheet.tsx";
import { UpNextRow } from "./UpNextRow.tsx";

/**
 * The lines not being worked on: up next in order, proposals, tabled and done lately. Starting one that waited opens
 * its Start sheet first, which shows what it holds.
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
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  /** The waiting line whose Start sheet is open. */
  starting: string | null;
  /** On a phone, or at a place, up next and proposals fold to tiles too, as E-Phone draws them. */
  narrow?: boolean;
  /** On a phone the tiles name nothing, for want of room: the name and the count. */
  phone?: boolean;
  /** A line's handle, which drags it or opens its moves. */
  handle(title: string, ref: string, index: number, count: number, section: "working" | "up_next"): ReactNode;
  drop(ref: string, section: "working" | "up_next"): DropTarget;
  onStarting(ref: string | null): void;
  /** Whether an open Start sheet's number keys act: not while a panel is open over home. */
  sheetArmed?: boolean;
}) {
  const sheet = (ref: string) => {
    const line = [...home.upNext, ...home.tabled, ...home.proposed].find(
      (candidate) => candidate.ref === ref,
    );
    return starting !== ref || line === undefined ? null : (
      <StartSheet
        line={line}
        onDoneWhen={h.doneWhen}
        onStart={(started) => {
          h.start(started);
          onStarting(null);
        }}
        onCancel={() => onStarting(null)}
        armed={sheetArmed}
      />
    );
  };
  const quiet = (
    <>
      <FoldedSection
        title="Tabled"
        names={home.tabled.map((line) => line.title)}
        named={!phone}
        dashed
        note={heldOnTabled(home)}
      >
        {home.tabled.map((line) => (
          <div key={line.ref}>
            <QuietRow line={line} onStart={onStarting} onQueue={h.queue} />
            {sheet(line.ref)}
          </div>
        ))}
      </FoldedSection>
      <FoldedSection title="Done lately" names={home.doneLately.map((line) => line.title)} named={!phone}>
        {home.doneLately.map((line) => (
          <QuietRow key={line.ref} line={line} />
        ))}
      </FoldedSection>
    </>
  );
  const upNextList = (
    <ol className="next-list">
      {home.upNext.map((line, index) => {
        const details = home.lines[line.ref];
        const crew = home.crews[line.ref];
        return (
          <Fragment key={line.ref}>
            <UpNextRow
              index={home.working.length + index + 1}
              line={line}
              {...(crew === undefined ? {} : { crew })}
              {...(details === undefined ? {} : { details })}
              handle={handle(line.title, line.ref, index, home.upNext.length, "up_next")}
              focused={focus === lineFocusRef(line.ref)}
              drop={drop(line.ref, "up_next")}
              onStart={onStarting}
            />
            {/* A list holds only items, so the sheet opened under a row is an item of its own. */}
            {starting === line.ref ? <li className="next-sheet">{sheet(line.ref)}</li> : null}
          </Fragment>
        );
      })}
    </ol>
  );
  const proposals = (
    <>
      {home.proposed.map((line) => (
        <Fragment key={line.ref}>
          <ProposalCard
            line={line}
            focused={focus === line.ref}
            foldTargets={[...home.working, ...home.upNext]}
            repos={line.repos.map(h.repoName)}
            firstStep={home.lines[line.ref]?.step?.title ?? null}
            lastUpNext={home.upNext.at(-1)?.title ?? null}
            // A line back from tabled may hold questions and tasks, so it starts through its Start sheet.
            onStart={line.tabledReason === null ? h.start : onStarting}
            onQueue={h.queue}
            onTable={h.table}
            onFold={h.fold}
            onReject={h.reject}
            onDrop={h.drop}
          />
          {sheet(line.ref)}
        </Fragment>
      ))}
    </>
  );
  if (narrow) {
    return (
      <div className="tiles">
        <FoldedSection title="Up next" names={home.upNext.map((line) => line.title)} named={!phone}>
          {upNextList}
        </FoldedSection>
        <FoldedSection
          title="Proposed by agents"
          names={home.proposed.map((line) => line.title)}
          named={!phone}
          tone="info"
        >
          {proposals}
        </FoldedSection>
        {quiet}
      </div>
    );
  }
  return (
    <>
      <HomeSection
        title="Up next"
        count={home.upNext.length}
        note="scoped by idle agents, never built, until you start them"
      >
        {home.upNext.length === 0 ? <p className="muted">Nothing is up next.</p> : upNextList}
      </HomeSection>
      {home.proposed.length === 0 ? null : (
        <HomeSection title="Proposed" count={home.proposed.length}>
          {proposals}
        </HomeSection>
      )}
      <div className="tiles">{quiet}</div>
    </>
  );
}
