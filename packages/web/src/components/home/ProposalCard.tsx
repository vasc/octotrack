import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { timeAgo } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { FoldPicker } from "./FoldPicker.tsx";
import { ProposalCase } from "./ProposalCase.tsx";
import { ProposalChoices } from "./ProposalChoices.tsx";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

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
    <Row
      label={line.title}
      focusRef={line.ref}
      current={focused}
      {...(line.urgentReason === null
        ? {}
        : { kind: `Urgent · ${URGENT_REASON[line.urgentReason]}`, tone: "stuck" as const })}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      facts={
        <Facts>
          {line.proposedBy === null ? null : `${line.proposedBy}, ${age(line.createdAt, now)}`}
          {repos.length === 0 ? null : repos.join(", ")}
          {firstStep === null || firstStep === undefined ? null : `first step: ${firstStep}`}
          {line.fromRef === null ? null : `from ${line.fromRef}`}
        </Facts>
      }
      {...(line.doneWhen === ""
        ? {}
        : {
            note: (
              <>
                Done when <Markdown text={line.doneWhen} inline />
              </>
            ),
          })}
    >
      <ProposalCase line={line} lastUpNext={lastUpNext} />
      {mode === "fold" ? (
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
      {mode === "table" ? (
        <TableForm
          title={line.title}
          onTable={(reason, lookAgainAt) => {
            onTable(line.ref, reason, lookAgainAt);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      ) : null}
    </Row>
  );
}
