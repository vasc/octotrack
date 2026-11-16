import type { AgentView } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import { foldedNames } from "../../lib/lines.ts";
import { List } from "../ui/List.tsx";
import { TextLink } from "../ui/RefLink.tsx";

/** How many quiet agents show before the rest fold to one line. */
const QUIET_SHOWN = 3;

/**
 * The roster: running, asleep, stopped and gone agents always show, since each may need the developer; quiet ones
 * after the first few fold to one line naming them, which shows the rest.
 */
export function AgentRoster({
  agents,
  row,
}: {
  agents: readonly AgentView[];
  /** Draws one agent. */
  row(agent: AgentView): ReactNode;
}) {
  // Showing every quiet agent is a choice on this screen alone, so it is the component's own state.
  const [all, setAll] = useState(false);
  const quiet = agents.filter((agent) => agent.state === "quiet");
  const folded = all ? [] : quiet.slice(QUIET_SHOWN);
  const shown = agents.filter((agent) => !folded.includes(agent));
  return (
    <>
      <List>{shown.map(row)}</List>
      {folded.length === 0 ? null : (
        <TextLink onClick={() => setAll(true)}>
          {folded.length} more quiet: {foldedNames(folded.map((agent) => agent.name))}
        </TextLink>
      )}
    </>
  );
}
