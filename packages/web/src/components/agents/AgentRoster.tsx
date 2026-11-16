import type { AgentView } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import { foldedNames } from "../../lib/lines.ts";
import { TextLink } from "../ui/RefLink.tsx";
import { Table } from "../ui/Table.tsx";

/** The roster's order by state: running first, quiet last. */
const STATE_ORDER: readonly AgentView["state"][] = ["running", "asleep", "stopped", "gone", "quiet"];

/** How many quiet agents show before the rest fold to one row. */
const QUIET_SHOWN = 3;

/**
 * The roster, a table headed Agent, Repo, Now and Last seen: running, asleep, stopped and gone agents always show, since
 * each may need the developer; quiet ones after the first few fold to one row naming them, which shows the rest.
 */
export function AgentRoster({
  agents,
  row,
}: {
  agents: readonly AgentView[];
  /** Draws one agent, as a row of the table. */
  row(agent: AgentView): ReactNode;
}) {
  // Showing every quiet agent is a choice on this screen alone, so it is the component's own state.
  const [all, setAll] = useState(false);
  // Its own order, whatever the tracker's: those that may need the developer first, then the quiet, each by name.
  const ordered = [...agents].sort(
    (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.name.localeCompare(b.name),
  );
  const quiet = ordered.filter((agent) => agent.state === "quiet");
  const folded = all ? [] : quiet.slice(QUIET_SHOWN);
  const shown = ordered.filter((agent) => !folded.includes(agent));
  return (
    <Table
      label="Agents"
      columns={["Agent", "Repo", "Now", "Last seen", ""]}
      {...(folded.length === 0
        ? {}
        : {
            foot: (
              <TextLink onClick={() => setAll(true)}>
                {folded.length} more quiet:{" "}
                {foldedNames(
                  folded.map((agent) => agent.name),
                  4,
                )}
              </TextLink>
            ),
          })}
    >
      {shown.map(row)}
    </Table>
  );
}
