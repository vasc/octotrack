import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { FoldPicker } from "./FoldPicker.tsx";
import { Markdown } from "../ui/Markdown.tsx";

const URGENT: Readonly<Record<NonNullable<Line["urgentReason"]>, string>> = {
  broken: "something is broken",
  time_boxed: "it is time-boxed",
  costs_money: "waiting costs money",
};

const RECOMMENDED: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into another line",
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

/**
 * A proposed line: what it is and who proposed it, the agent's recommended placement and why, and the five choices a
 * proposal has, numbered, with the recommended one filled.
 */
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
  const fromTable = line.tabledReason !== null;
  const recommended = (placement: NonNullable<Line["recommendation"]>) =>
    !fromTable && line.recommendation === placement;
  const lastNumber = foldTargets.length === 0 ? "4" : "5";
  return (
    <article
      className="proposal-card"
      aria-label={line.title}
      data-selected={focused}
      data-focus-ref={line.ref}
      tabIndex={-1}
      data-urgent={line.urgentReason !== null}
    >
      <div className="proposal-text">
        {line.urgentReason === null ? null : (
          <p className="home-urgent">Urgent: {URGENT[line.urgentReason]}</p>
        )}
        <p>
          <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
            {line.title}
          </button>
          <span className="line-facts">
            {line.proposedBy === null ? null : <span> · proposed by {line.proposedBy}</span>}
            {line.fromRef === null ? null : <span> · from before ({line.fromRef})</span>}
            {line.doneWhen === "" ? null : (
              <span>
                {" "}
                · done when <Markdown text={line.doneWhen} inline />
              </span>
            )}
          </span>
        </p>
        {fromTable ? (
          <p className="proposal-case">
            Back to look at, as you asked: {line.tabledReason}
            {line.lookAgainAt === null ? "" : ` (${line.lookAgainAt.slice(0, 10)})`}
          </p>
        ) : line.recommendation === null ? null : (
          <p className="proposal-case">
            <b>Recommended: {RECOMMENDED[line.recommendation]}.</b>{" "}
            {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
          </p>
        )}
      </div>
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
        <FoldPicker
          title={line.title}
          targets={foldTargets}
          onFold={(into) => onFold(line.ref, into)}
          onCancel={() => setMode(null)}
        />
      ) : (
        <div className="proposal-choices">
          <button
            type="button"
            className="btn"
            aria-label={`Start ${line.title}`}
            data-choice="1"
            data-primary={recommended("start")}
            onClick={() => onStart(line.ref)}
          >
            Start{recommended("start") ? " · recommended" : ""}
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Up next ${line.title}`}
            data-choice="2"
            data-primary={recommended("up_next")}
            onClick={() => onQueue(line.ref)}
          >
            Up next{recommended("up_next") ? " · recommended" : ""}
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Table ${line.title}`}
            data-choice="3"
            data-primary={recommended("table")}
            onClick={() => setMode("table")}
          >
            Table
          </button>
          {foldTargets.length === 0 ? null : (
            <button
              type="button"
              className="btn"
              aria-label={`Fold ${line.title}`}
              data-choice="4"
              data-primary={recommended("fold")}
              onClick={() => setMode("fold")}
            >
              Fold into
            </button>
          )}
          {fromTable ? (
            <button
              type="button"
              className="btn"
              data-quiet="true"
              aria-label={`Drop ${line.title}`}
              data-choice={lastNumber}
              onClick={() => onDrop(line.ref)}
            >
              Drop
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              data-quiet="true"
              aria-label={`Not a line: ${line.title}`}
              data-choice={lastNumber}
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
