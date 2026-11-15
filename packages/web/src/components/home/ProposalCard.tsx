import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { timeAgo } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { FoldPicker } from "./FoldPicker.tsx";
import { ProposalCase } from "./ProposalCase.tsx";
import { ProposalChoices } from "./ProposalChoices.tsx";
import { Markdown } from "../ui/Markdown.tsx";

const URGENT: Readonly<Record<NonNullable<Line["urgentReason"]>, string>> = {
  broken: "something is broken",
  time_boxed: "it is time-boxed",
  costs_money: "waiting costs money",
};

/** How long ago, as a phrase: "just now", "2h ago". */
function age(iso: string, now: number): string {
  const ago = timeAgo(iso, now);
  return ago === "now" ? "just now" : `${ago} ago`;
}

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
  /** Its repos, by their GitHub names. */
  repos?: readonly string[];
  /** The first step of the plan its agent wrote, if any. */
  firstStep?: string | null;
  /** The last line up next, which an Up next recommendation would put it after. */
  lastUpNext?: string | null;
  /** The time now, for how long ago it was proposed. */
  now?: number;
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
  repos = [],
  firstStep = null,
  lastUpNext = null,
  now = Date.now(),
}: ProposalCardProps) {
  const [mode, setMode] = useState<"table" | "fold" | null>(null);
  const fromTable = line.tabledReason !== null;
  return (
    <article
      className="proposal-card"
      aria-label={line.title}
      data-selected={focused}
      aria-current={focused ? "true" : undefined}
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
          {/* The dots between facts are drawn by the stylesheet, so facts on a line of their own start clean. */}{" "}
          <span className="line-facts" data-separated="true">
            {line.proposedBy === null ? null : (
              <span>
                proposed by {line.proposedBy}, {age(line.createdAt, now)}
              </span>
            )}
            {repos.length === 0 ? null : <span className="mono">{repos.join(", ")}</span>}
            {firstStep === null || firstStep === undefined ? null : <span>first step: {firstStep}</span>}
            {line.fromRef === null ? null : <span>from before ({line.fromRef})</span>}
            {line.doneWhen === "" ? null : (
              <span>
                done when <Markdown text={line.doneWhen} inline />
              </span>
            )}
          </span>
        </p>
        <ProposalCase line={line} lastUpNext={lastUpNext} />
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
        <ProposalChoices
          title={line.title}
          recommended={fromTable ? null : line.recommendation}
          canFold={foldTargets.length > 0}
          fromTable={fromTable}
          onStart={() => onStart(line.ref)}
          onQueue={() => onQueue(line.ref)}
          onTable={() => setMode("table")}
          onFold={() => setMode("fold")}
          onReject={() => onReject(line.ref)}
          onDrop={() => onDrop(line.ref)}
        />
      )}
    </article>
  );
}
