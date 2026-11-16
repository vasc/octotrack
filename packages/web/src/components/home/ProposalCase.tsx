import type { Line } from "@octotrack/core/schemas";
import { whenText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";

export const MOVE_WORD: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into another line",
};

/**
 * Where its agent recommends a proposal goes and why, in one sentence ("Recommends Start: the release is built"); or,
 * for a line back from tabled, the reason it was tabled. Words in a line, drawn as its row's note.
 */
export function ProposalCase({ line, lastUpNext = null }: { line: Line; lastUpNext?: string | null }) {
  if (line.tabledReason !== null)
    return (
      <>
        Tabled: {line.tabledReason}
        {line.lookAgainAt === null ? "" : ` · look again ${whenText(line.lookAgainAt)}`}
      </>
    );
  if (line.recommendation === null) return null;
  return (
    <>
      <b>
        Recommends {MOVE_WORD[line.recommendation]}
        {line.recommendation === "up_next" && lastUpNext !== null ? `, after ${lastUpNext}` : ""}:
      </b>{" "}
      {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
    </>
  );
}
