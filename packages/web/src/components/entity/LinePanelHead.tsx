import type { Line, LineDetail } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { closeEntity, navigate } from "../../lib/router.ts";
import { Inset } from "../ui/Inset.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Panel } from "../ui/Panel.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { StatusLine } from "../ui/StatusLine.tsx";
import { LineFacts } from "./LineFacts.tsx";
import { LineStanding } from "./LineStanding.tsx";
/**
 * A line opened in a peek, as triage/T-Peek-Line draws it: where it stands, small and grey; its title; its headline;
 * who is on it after a dot; why it waits when tabled, what its proposer recommends; what finishes it in a box of its
 * own; then its parts, and Tell at its foot. Close shuts the panel; Back, when it was opened from another, returns
 * there; its own page holds all of it.
 */
export function LinePanelHead({
  line,
  repos,
  held,
  now = Date.now(),
  back,
  branchOf = null,
  status,
  foot,
  children,
}: {
  line: Line;
  /** Its repos, by GitHub name where one is set. */
  repos: readonly string[];
  /** What waits on the developer and is held while the line waits. */
  held?: { questions: number; tasks: number };
  now?: number;
  /** Opened from another peek: what that one is, and the way back to it. */
  back?: { label: string; onBack(): void } | undefined;
  /** The plan branch it grew out of, and the step there that waits for it. */
  branchOf?: LineDetail["branchOf"];
  /** Who is on it, in a sentence after a dot. */
  status?: { text: string; live: boolean } | null;
  /** What stays at its foot, such as Tell. */
  foot?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Panel
      crumbs={<LineFacts line={line} repos={repos} now={now} />}
      title={line.title}
      onClose={closeEntity}
      back={back}
      page={{ href: `/lines/${line.ref}`, onGo: (href) => navigate(href) }}
      head={
        <Stack>
          {line.headline === null ? null : <Markdown text={line.headline} inline />}
          {status === undefined || status === null ? null : (
            <StatusLine live={status.live}>{status.text}</StatusLine>
          )}
          <LineStanding line={line} held={held} now={now} branchOf={branchOf} withDoneWhen={false} />
          {line.doneWhen === "" ? null : (
            <Inset label="Done when">
              <Markdown text={line.doneWhen} inline />
            </Inset>
          )}
        </Stack>
      }
      foot={foot}
    >
      {children}
    </Panel>
  );
}
