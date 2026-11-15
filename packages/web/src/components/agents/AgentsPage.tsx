import { contracts } from "@octotrack/core/contracts";
import { useChoices } from "../../hooks/useChoices.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { usePush } from "../../hooks/usePush.ts";
import { homeLines, lineFacts } from "../../lib/lines.ts";
import { PushToggle } from "../home/PushToggle.tsx";
import { List } from "../ui/List.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { Page } from "../ui/Page.tsx";
import { EmptyState, ErrorState } from "../ui/states.tsx";
import { AgentRosterRow } from "./AgentRosterRow.tsx";

/**
 * Who is out there, and where, as E-Agents draws it: one row per agent. The only actions are Stop, Lift on a stopped
 * agent, and Release on a quiet one holding a line; what needs the developer is on Lines.
 */
export function AgentsPage() {
  const agents = useOpQuery(contracts.agentList, {});
  const push = usePush();
  const choices = useChoices();
  const h = useHome();
  const home = h.home.data;
  const lines = homeLines(home);
  const facts = (ref: string | null) => lineFacts(lines, home?.lines ?? {}, ref);
  const roster = agents.data ?? [];
  return (
    <Page
      title="Agents"
      aside={<PushToggle state={push.state} error={push.error} onTurnOn={() => void push.turnOn()} />}
    >
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
      <Loaded loaded={agents.data !== undefined} error={agents.error} label="Loading agents">
        {roster.length === 0 ? (
          <EmptyState command="export OCTO_AGENT=feature-x">No agents yet</EmptyState>
        ) : (
          <List>
            {roster.map((agent) => (
              <AgentRosterRow
                key={agent.name}
                agent={agent}
                {...(agent.repo === null ? {} : { repo: h.repoName(agent.repo) })}
                {...facts(agent.line ?? agent.start?.line ?? agent.lastLine)}
                onStop={(name) => choices.make(contracts.agentStop.name, { name }, `Stopping ${name}`)}
                onLift={(name) => choices.make(contracts.agentLift.name, { name }, `Lifting ${name}'s stop`)}
                onRelease={(name) =>
                  choices.make(contracts.agentRelease.name, { name }, `Releasing ${name} from its line`)
                }
              />
            ))}
          </List>
        )}
      </Loaded>
    </Page>
  );
}
