import type { Line } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { backEntity } from "../../lib/router.ts";
import { Facts } from "../ui/Facts.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Code, Note } from "../ui/Note.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { Panel } from "../ui/Panel.tsx";

/**
 * A line opened: where it stands and sits in the order, its ref and repos, its title, what finishes it and its moves,
 * then its parts. Close goes back to what was open before it.
 */
export function LinePanelHead({
  line,
  position,
  repos,
  actions,
  children,
}: {
  line: Line;
  /** "Line 2 of 5", for a line in the order. */
  position: string | null;
  /** Its repos, by GitHub name where one is set. */
  repos: readonly string[];
  /** Its moves, under what finishes it. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Panel
      crumbs={
        <Facts>
          {LINE_STATE_LABEL[line.state]}
          {position}
          <Code>{line.ref}</Code>
          {repos.map((repo) => (
            <Code key={repo}>{repo}</Code>
          ))}
        </Facts>
      }
      title={line.title}
      onClose={backEntity}
    >
      <Stack>
        {line.doneWhen === "" ? null : (
          <Note>
            Done when <Markdown text={line.doneWhen} inline />
          </Note>
        )}
        {actions}
      </Stack>
      {children}
    </Panel>
  );
}
