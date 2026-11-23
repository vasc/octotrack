import type { Line, LineDetail } from "@octotrack/core/schemas";
import { dayDate } from "../../lib/format.ts";
import { heldText, RECOMMENDED_MOVE } from "../../lib/lines.ts";
import { Callout } from "../ui/Callout.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { RefLink } from "../ui/RefLink.tsx";

/**
 * What a line is for and how it stands, under its title: why it waits when tabled, the branch it grew from, what
 * finishes it, what its proposer recommends.
 */
export function LineStanding({
  line,
  held,
  now = Date.now(),
  branchOf = null,
  withDoneWhen = true,
}: {
  line: Line;
  /** What waits on the developer and is held while the line waits. */
  held?: { questions: number; tasks: number } | undefined;
  now?: number;
  /** The plan branch it grew out of, and the step there that waits for it. */
  branchOf?: LineDetail["branchOf"];
  /** What finishes it is said here; the line's own page says it beside its plan instead (triage/T-Line). */
  withDoneWhen?: boolean;
}) {
  const heldWords = held === undefined ? null : heldText(held);
  const recommends = line.state === "proposed" && line.recommendation !== null;
  // Nothing to say under the title is no block at all, so it leaves no gap above what follows.
  if (line.state !== "tabled" && branchOf === null && (!withDoneWhen || line.doneWhen === "") && !recommends)
    return null;
  return (
    <Stack>
      {line.state === "tabled" ? (
        <Pairs
          pairs={[
            ["Waits for", line.tabledReason],
            ["Look again", line.lookAgainAt === null ? null : dayDate(line.lookAgainAt, now)],
            ["Held", heldWords],
          ]}
        />
      ) : null}
      {branchOf === null ? null : (
        <Note>
          <Icon name="branch" /> Branch {branchOf.address} of <RefLink value={branchOf.line} />{" "}
          {branchOf.title}
          {branchOf.holdsUp === null
            ? "."
            : `; holds up its step ${branchOf.holdsUp.address}, ${branchOf.holdsUp.title}.`}
        </Note>
      )}
      {!withDoneWhen || line.doneWhen === "" ? null : (
        <Labelled label="Done when">
          <Markdown text={line.doneWhen} inline />
        </Labelled>
      )}
      {recommends && line.recommendation !== null ? (
        <Callout lead={`Recommended: ${RECOMMENDED_MOVE[line.recommendation]}.`}>
          {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
        </Callout>
      ) : null}
    </Stack>
  );
}
