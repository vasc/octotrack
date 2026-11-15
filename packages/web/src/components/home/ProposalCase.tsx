import { whenText } from "../../lib/format.ts";
import type { Line } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";

const RECOMMENDED: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into another line",
};

/**
 * Why a proposal should go where its agent recommends, and where Up next would put it; or, for a line back from tabled,
 * the developer's own reason for tabling it.
 */
export function ProposalCase({ line, lastUpNext = null }: { line: Line; lastUpNext?: string | null }) {
  if (line.tabledReason !== null) {
    return (
      <p className="proposal-case">
        Back to look at, as you asked: {line.tabledReason}
        {line.lookAgainAt === null ? "" : ` (look again ${whenText(line.lookAgainAt)})`}
      </p>
    );
  }
  if (line.recommendation === null) return null;
  return (
    <p className="proposal-case">
      <b>
        Recommended: {RECOMMENDED[line.recommendation]}
        {line.recommendation === "up_next" && lastUpNext !== null ? `, after ${lastUpNext}` : ""}.
      </b>{" "}
      {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
    </p>
  );
}
