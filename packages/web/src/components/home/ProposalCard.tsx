import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { recommendationText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";

export interface ProposalCardProps {
  line: Line;
  /** Lines it could fold into: those still open. */
  foldTargets: readonly Line[];
  onStart(ref: string): void;
  onQueue(ref: string): void;
  onTable(ref: string, reason: string): void;
  onFold(ref: string, into: string): void;
  onReject(ref: string): void;
}

/** A proposed line with the agent's case for it, and every choice a proposal has. */
export function ProposalCard({
  line,
  foldTargets,
  onStart,
  onQueue,
  onTable,
  onFold,
  onReject,
}: ProposalCardProps) {
  const [mode, setMode] = useState<"table" | "fold" | null>(null);
  const advice = recommendationText(line);
  const fromTable = line.tabledReason !== null;
  return (
    <article className="proposal" aria-label={line.title}>
      <button type="button" className="home-line-title" onClick={() => openEntity(line.ref)}>
        {line.title}
      </button>
      <p className="home-meta">
        {line.proposedBy === null ? null : <span>proposed by {line.proposedBy}</span>}
        {line.fromRef === null ? null : <span>from before ({line.fromRef})</span>}
        {line.doneWhen === "" ? null : <span>done when {line.doneWhen}</span>}
      </p>
      {fromTable ? (
        <p className="home-headline">
          Back to look at, as you asked: {line.tabledReason}
          {line.lookAgainAt === null ? "" : ` (${line.lookAgainAt.slice(0, 10)})`}
        </p>
      ) : advice === null ? null : (
        <p className="home-headline">
          {advice}
          {line.recommendationWhy === null ? "" : `: ${line.recommendationWhy}`}
        </p>
      )}
      {mode === "table" ? (
        <TableForm
          title={line.title}
          onTable={(reason) => {
            onTable(line.ref, reason);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : mode === "fold" ? (
        <div className="decision-actions">
          <select
            className="select"
            aria-label={`Fold ${line.title} into`}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value !== "") onFold(line.ref, event.target.value);
            }}
          >
            <option value="">Fold into…</option>
            {foldTargets.map((target) => (
              <option key={target.ref} value={target.ref}>
                {target.ref} {target.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="decision-actions">
          <button
            type="button"
            className="btn"
            aria-label={`Start ${line.title}`}
            onClick={() => onStart(line.ref)}
          >
            Start
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Up next ${line.title}`}
            onClick={() => onQueue(line.ref)}
          >
            Up next
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Table ${line.title}`}
            onClick={() => setMode("table")}
          >
            Table…
          </button>
          {foldTargets.length === 0 ? null : (
            <button
              type="button"
              className="btn"
              aria-label={`Fold ${line.title}`}
              onClick={() => setMode("fold")}
            >
              Fold into…
            </button>
          )}
          <button
            type="button"
            className="btn"
            aria-label={`Not a line: ${line.title}`}
            onClick={() => onReject(line.ref)}
          >
            {fromTable ? "Drop" : "Not a line"}
          </button>
        </div>
      )}
    </article>
  );
}
