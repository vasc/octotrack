import type { Line } from "@octotrack/core/schemas";
import { whenText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";

export const MOVE_WORD: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into another line",
};

/**
 * Where its agent recommends a proposal goes and why, in one sentence ("Recommends Start: the release is built"); or,
 * for a line back from tabled, the reason it was tabled.
 */
export function ProposalCase({ line, lastUpNext = null }: { line: Line; lastUpNext?: string | null }) {
  if (line.tabledReason !== null)
    return (
      <Note>
        Tabled: {line.tabledReason}
        {line.lookAgainAt === null ? "" : ` · look again ${whenText(line.lookAgainAt)}`}
      </Note>
    );
  if (line.recommendation === null) return null;
  return (
    <Note>
      <b>
        Recommends {MOVE_WORD[line.recommendation]}
        {line.recommendation === "up_next" && lastUpNext !== null ? `, after ${lastUpNext}` : ""}:
      </b>{" "}
      {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
    </Note>
  );
}
