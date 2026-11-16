import type { Line } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { dayDate, sinceText } from "../../lib/format.ts";
import { heldText, LINE_STATE_LABEL, RECOMMENDED_MOVE } from "../../lib/lines.ts";
import { closeEntity } from "../../lib/router.ts";
import { Callout } from "../ui/Callout.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Code, Note } from "../ui/Note.tsx";
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
              <Kind tone="none">{LINE_STATE_LABEL[line.state]}</Kind> {sinceText(line.updatedAt, now)}
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
          {closed ? <Note>Plan, summary and history stay below, as they were when it closed.</Note> : actions}
        </Stack>
      }
    >
      {children}
    </Panel>
  );
}
