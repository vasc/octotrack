import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { openEntity } from "../../lib/router.ts";
import { TableForm } from "../lines/TableForm.tsx";
import { FoldPicker } from "./FoldPicker.tsx";
import { ProposalCase } from "./ProposalCase.tsx";
import { ProposalChoices } from "./ProposalChoices.tsx";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { Code } from "../ui/Note.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

interface ProposalCardProps {
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
  /** Its repos, by their keys. */
  repoKeys?: readonly string[];
  /** The last line up next, which an Up next recommendation would put it after. */
  lastUpNext?: string | null;
  /** A move of it waits with Undo. */
  busy?: boolean;
  /** Drawn under a group that already says the move, as on first run. */
  grouped?: boolean;
}

/**
 * A proposed line: its title; its ref, repos and who proposed it; the agent's recommended move and why; then that move
 * as the one button with the others under Other.
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
  repoKeys = [],
  lastUpNext = null,
  busy = false,
  grouped = false,
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
        : { kind: URGENT_REASON[line.urgentReason], tone: "stuck" as const })}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      facts={
        <Facts>
          <Code>{line.ref}</Code>
          {repoKeys.join(", ")}
          {line.proposedBy === null ? null : `proposed by ${line.proposedBy}`}
        </Facts>
      }
      note={<ProposalCase line={line} lastUpNext={lastUpNext} whyOnly={grouped} />}
      trailing={
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
          busy={busy}
        />
      }
    >
      {mode === "fold" ? (
        <FoldPicker
          title={line.title}
          targets={foldTargets}
          onFold={(into) => onFold(line.ref, into)}
          onCancel={() => setMode(null)}
        />
      ) : null}
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
