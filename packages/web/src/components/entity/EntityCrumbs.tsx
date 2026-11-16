import type { Drift, EntitySummary } from "@octotrack/core/schemas";
import { KIND_WORD, shortDate } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { Code } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";

/**
 * Where an item opened by its ref sits, in words after its ref: "PR-1 · STACK", "DR-55 · out of date · on INFRA ·
 * since 7 Nov", "PANEL · repo", "I-7 · idea, from before lines". Its state is said under the title, not here.
 */
export function EntityCrumbs({ summary, drift }: { summary: EntitySummary; drift?: Drift | undefined }) {
  const word = (KIND_WORD[summary.kind] ?? summary.kind).toLowerCase();
  if (drift !== undefined) {
    return (
      <Facts>
        <Code>{summary.ref}</Code>
        out of date
        <span>
          on <RefLink value={drift.target} />
        </span>
        {`since ${shortDate(drift.createdAt)}`}
      </Facts>
    );
  }
  return (
    <Facts>
      <Code>{summary.ref}</Code>
      {summary.kind === "pr" ? null : word}
      {summary.project === null || summary.project === summary.ref ? null : <Code>{summary.project}</Code>}
    </Facts>
  );
}
