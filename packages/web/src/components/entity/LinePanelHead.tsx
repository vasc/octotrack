import type { Line, LineDetail } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { closeEntity, navigate } from "../../lib/router.ts";
import { Panel } from "../ui/Panel.tsx";
import { LineFacts } from "./LineFacts.tsx";
import { LineStanding } from "./LineStanding.tsx";
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
  /** Opened from another peek: what that one is, and the way back to it. */
  back?: { label: string; onBack(): void } | undefined;
  /** Its moves, under what finishes it. */
  actions?: ReactNode;
  /** The plan branch it grew out of, and the step there that waits for it. */
  branchOf?: LineDetail["branchOf"];
  children?: ReactNode;
}) {
  return (
    <Panel
      crumbs={<LineFacts line={line} repos={repos} now={now} />}
      title={line.title}
      onClose={closeEntity}
      back={back}
      page={{ href: `/lines/${line.ref}`, onGo: (href) => navigate(href) }}
      head={<LineStanding line={line} held={held} now={now} branchOf={branchOf} actions={actions} />}
    >
      {children}
    </Panel>
  );
}
