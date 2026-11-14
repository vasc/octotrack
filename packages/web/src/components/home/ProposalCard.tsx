import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { recommendationText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { Markdown } from "../ui/Markdown.tsx";

const URGENT: Readonly<Record<NonNullable<Line["urgentReason"]>, string>> = {
  broken: "something is broken",
  time_boxed: "it is time-boxed",
  costs_money: "waiting costs money",
};

export interface ProposalCardProps {
  line: Line;
  focused?: boolean;
  /** Lines it could fold into: those still open. */
  foldTargets: readonly Line[];
  onStart(ref: string): void;
  onQueue(ref: string): void;
  onTable(ref: string, reason: string, lookAgainAt: string | null): void;
  onFold(ref: string, into: string): void;
  onReject(ref: string): void;
  /** For a tabled line back to look at: it was a line, so it is dropped, not rejected. */
  onDrop(ref: string): void;
}

/** A proposed line with the agent's case for it, and every choice a proposal has. */
export function ProposalCard({
  line,
  focused = false,
  foldTargets,
  onStart,
  onQueue,
  onTable,
  onFold,
  onReject,
  onDrop,
}: ProposalCardProps) {
  const [mode, setMode] = useState<"table" | "fold" | null>(null);
  const advice = recommendationText(line);
  const fromTable = line.tabledReason !== null;
  return (
    <article
      className="proposal"
      aria-label={line.title}
      data-selected={focused}
      data-urgent={line.urgentReason !== null}
    >
      <button type="button" className="home-line-title" onClick={() => openEntity(line.ref)}>
        {line.title}
      </button>
      <p className="home-meta">
        {line.proposedBy === null ? null : <span>proposed by {line.proposedBy}</span>}
        {line.fromRef === null ? null : <span>from before ({line.fromRef})</span>}
        {line.doneWhen === "" ? null : (
          <span>
            done when <Markdown text={line.doneWhen} inline />
          </span>
        )}
      </p>
      {line.urgentReason === null ? null : <p className="home-urgent">Urgent: {URGENT[line.urgentReason]}</p>}
      {fromTable ? (
        <p className="home-headline">
          Back to look at, as you asked: {line.tabledReason}
          {line.lookAgainAt === null ? "" : ` (${line.lookAgainAt.slice(0, 10)})`}
        </p>
      ) : advice === null ? null : (
        <p className="home-headline">
          {advice}
          {line.recommendationWhy === null ? null : (
            <>
              : <Markdown text={line.recommendationWhy} inline />
            </>
          )}
        </p>
      )}
      {mode === "table" ? (
        <TableForm
          title={line.title}
          onTable={(reason, lookAgainAt) => {
            onTable(line.ref, reason, lookAgainAt);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : mode === "fold" ? (
        <fieldset className="choice-group">
          <legend className="muted">Fold {line.title} into</legend>
          {foldTargets.map((target) => (
            <button
              key={target.ref}
              type="button"
              className="btn"
              aria-label={`Fold ${line.title} into ${target.title}`}
              onClick={() => onFold(line.ref, target.ref)}
            >
              {target.ref} {target.title}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </fieldset>
      ) : (
        <div className="decision-actions">
          <button
            type="button"
            className="btn"
            aria-label={`Start ${line.title}`}
            data-choice="1"
            onClick={() => onStart(line.ref)}
          >
            Start
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Up next ${line.title}`}
            data-choice="2"
            onClick={() => onQueue(line.ref)}
          >
            Up next
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Table ${line.title}`}
            data-choice="3"
            onClick={() => setMode("table")}
          >
            Table…
          </button>
          {foldTargets.length === 0 ? null : (
            <button
              type="button"
              className="btn"
              aria-label={`Fold ${line.title}`}
              data-choice="4"
              onClick={() => setMode("fold")}
            >
              Fold into…
            </button>
          )}
          {fromTable ? (
            <button
              type="button"
              className="btn"
              aria-label={`Drop ${line.title}`}
              data-choice={foldTargets.length === 0 ? "4" : "5"}
              onClick={() => onDrop(line.ref)}
            >
              Drop
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              aria-label={`Not a line: ${line.title}`}
              data-choice={foldTargets.length === 0 ? "4" : "5"}
              onClick={() => onReject(line.ref)}
            >
              Not a line
            </button>
          )}
        </div>
      )}
    </article>
  );
}
