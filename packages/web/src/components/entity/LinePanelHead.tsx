import type { Line, LineDetail } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { dayDate, sinceText, timeLabel } from "../../lib/format.ts";
import { heldText, LINE_STATE_LABEL, RECOMMENDED_MOVE } from "../../lib/lines.ts";
import { closeEntity } from "../../lib/router.ts";
import { Callout } from "../ui/Callout.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Code, Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { Panel } from "../ui/Panel.tsx";

/**
 * A line opened, its head read top to bottom: where it stands (its state, ref and repos; who proposed it; how it
 * closed), its title, why it waits when tabled, what finishes it, what its proposer recommends, then its moves; then
 * its parts. Close shuts the panel; Back, when it was opened from another, returns there.
 */
export function LinePanelHead({
  line,
  repos,
  held,
  now = Date.now(),
  back,
  under,
  actions,
  branchOf = null,
  children,
}: {
  line: Line;
  /** Its repos, by GitHub name where one is set. */
  repos: readonly string[];
  /** What waits on the developer and is held while the line waits. */
  held?: { questions: number; tasks: number };
  now?: number;
  /** Opened from another panel: the ref it came from and the way back. */
  back?: { label: string; onBack(): void } | undefined;
  /** The page it opens over, which its way back names on a phone. */
  under?: string;
  /** Its moves, under what finishes it. */
  actions?: ReactNode;
  /** The plan branch it grew out of, and the step there that waits for it. */
  branchOf?: LineDetail["branchOf"];
  children?: ReactNode;
}) {
  const closed = line.state === "done" || line.state === "dropped";
  const heldWords = held === undefined ? null : heldText(held);
  return (
    <Panel
      crumbs={
        <Facts>
          {line.state === "proposed" && line.proposedBy !== null ? (
            <>
              <Kind tone="none">Proposed</Kind> by {line.proposedBy}, {sinceText(line.createdAt, now)}
            </>
          ) : closed ? (
            <>
              {/* When it closed is when it last changed: a closed line takes no more changes. */}
              <Kind tone="none">{LINE_STATE_LABEL[line.state]}</Kind> · closed{" "}
              {timeLabel(line.updatedAt, now)}
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
      }
      title={line.title}
      onClose={closeEntity}
      {...(under === undefined ? {} : { under })}
      back={back}
      head={
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
          {line.doneWhen === "" ? null : (
            <Labelled label="Done when">
              <Markdown text={line.doneWhen} inline />
            </Labelled>
          )}
          {line.state === "proposed" && line.recommendation !== null ? (
            <Callout lead={`Recommended: ${RECOMMENDED_MOVE[line.recommendation]}.`}>
              {line.recommendationWhy === null ? null : <Markdown text={line.recommendationWhy} inline />}
            </Callout>
          ) : null}
          {actions}
        </Stack>
      }
    >
      {children}
    </Panel>
  );
}
