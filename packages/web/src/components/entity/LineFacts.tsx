import type { Line } from "@octotrack/core/schemas";
import { sinceText, timeLabel } from "../../lib/format.ts";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Code } from "../ui/Note.tsx";

/** Where a line stands, small and grey: its state, or who proposed it, or how it closed; whose it is; its ref and repos. */
export function LineFacts({
  line,
  repos,
  now = Date.now(),
}: {
  line: Line;
  /** Its repos, by GitHub name where one is set. */
  repos: readonly string[];
  now?: number;
}) {
  const closed = line.state === "done" || line.state === "dropped";
  return (
    <Facts>
      {line.state === "proposed" && line.proposedBy !== null ? (
        <>
          <Kind tone="none">Proposed</Kind> by {line.proposedBy}, {sinceText(line.createdAt, now)}
        </>
      ) : closed ? (
        <>
          {/* When it closed is when it last changed: a closed line takes no more changes. */}
          <Kind tone="none">{LINE_STATE_LABEL[line.state]}</Kind> · closed {timeLabel(line.updatedAt, now)}
        </>
      ) : (
        <Kind tone="none">{LINE_STATE_LABEL[line.state]}</Kind>
      )}
      {line.ownedBy === null ? null : "yours"}
      <Code>{line.ref}</Code>
      {repos.map((repo) => (
        <Code key={repo}>{repo}</Code>
      ))}
    </Facts>
  );
}
