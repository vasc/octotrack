import type { HomeView } from "@octotrack/core/schemas";
import { Fragment, type ReactNode } from "react";
import type { DragProps } from "../../hooks/useDragOrder.ts";
import type { HomeActions } from "../../hooks/useHome.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { FoldedSection } from "./FoldedSection.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { ProposalCard } from "./ProposalCard.tsx";
import { QuietRow } from "./QuietRow.tsx";
import { StartSheet } from "./StartSheet.tsx";
import { UpNextRow } from "./UpNextRow.tsx";

/** What the tabled lines hold, together: questions and tasks that wait for their line to start. */
function heldNote(home: HomeView): string | undefined {
  const held = home.tabled.reduce(
    (sum, line) => {
      const details = home.lines[line.ref];
      return details === undefined
        ? sum
        : { questions: sum.questions + details.held.questions, tasks: sum.tasks + details.held.tasks };
    },
    { questions: 0, tasks: 0 },
  );
  if (held.questions === 0 && held.tasks === 0) return undefined;
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return `${parts.join(" and ")} held`;
}

function withDrag(drag: DragProps | undefined): { drag?: DragProps } {
  return drag === undefined ? {} : { drag };
}

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
  reorder,
  drag,
  onStarting,
}: {
  home: HomeView;
  h: HomeActions;
  focus: string | null;
  /** The waiting line whose Start sheet is open. */
  starting: string | null;
  /** On a phone, up next and proposals fold to tiles too, as E-Phone draws them. */
  narrow?: boolean;
  reorder(title: string, ref: string, index: number, count: number): ReactNode;
  drag(ref: string, section: string): DragProps | undefined;
  onStarting(ref: string | null): void;
}) {
  const sheet = (ref: string) => {
    const line = [...home.upNext, ...home.tabled].find((candidate) => candidate.ref === ref);
    return starting !== ref || line === undefined ? null : (
      <StartSheet
        line={line}
        onDoneWhen={h.doneWhen}
        onStart={(started) => {
          h.start(started);
          onStarting(null);
        }}
        onCancel={() => onStarting(null)}
      />
    );
  };
  const quiet = (
    <>
      <FoldedSection title="Tabled" lines={home.tabled} dashed note={heldNote(home)}>
        {home.tabled.map((line) => (
          <div key={line.ref}>
            <QuietRow line={line} onStart={onStarting} onQueue={h.queue} />
            {sheet(line.ref)}
          </div>
        ))}
      </FoldedSection>
      <FoldedSection title="Done lately" lines={home.doneLately}>
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
              reorder={reorder(line.title, line.ref, index, home.upNext.length)}
              focused={focus === lineFocusRef(line.ref)}
              {...withDrag(drag(line.ref, "up_next"))}
              onStart={onStarting}
            />
            {sheet(line.ref)}
          </Fragment>
        );
      })}
    </ol>
  );
  const proposals = (
    <>
      {home.proposed.map((line) => (
        <ProposalCard
          key={line.ref}
          line={line}
          focused={focus === line.ref}
          foldTargets={[...home.working, ...home.upNext]}
          onStart={h.start}
          onQueue={h.queue}
          onTable={h.table}
          onFold={h.fold}
          onReject={h.reject}
          onDrop={h.drop}
        />
      ))}
    </>
  );
  if (narrow) {
    return (
      <div className="tiles">
        <FoldedSection title="Up next" lines={home.upNext}>
          {upNextList}
        </FoldedSection>
        <FoldedSection title="Proposed by agents" lines={home.proposed} tone="info">
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
