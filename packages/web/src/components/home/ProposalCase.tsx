import type { Line } from "@octotrack/core/schemas";
import { whenText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";

const MOVE_WORD: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into another line",
};

/**
 * Where its agent recommends a proposal goes and why, in one sentence ("Recommends Start: the release is built"); or,
 * for a line back from tabled, the reason it was tabled. Drawn as its row's note.
 */
export function ProposalCase({
  line,
  lastUpNext = null,
  whyOnly = false,
}: {
  line: Line;
  lastUpNext?: string | null;
  /** Under a group that already says the move, as on first run: only the why. */
  whyOnly?: boolean;
}) {
  if (line.tabledReason !== null)
    return (
      <>
        Tabled: {line.tabledReason}
        {line.lookAgainAt === null ? "" : ` · look again ${whenText(line.lookAgainAt)}`}
      </>
    );
  if (line.recommendation === null) return null;
  if (whyOnly)
    return line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />;
  return (
    <>
      <b>
        Recommends {MOVE_WORD[line.recommendation]}
        {line.recommendation === "up_next" && lastUpNext !== null ? `, after ${lastUpNext}` : ""}
        {line.recommendationWhy === null ? "." : ":"}
      </b>
      {line.recommendationWhy === null ? null : (
        <>
          {" "}
          <Markdown text={line.recommendationWhy} inline />
        </>
      )}
    </>
  );
}
