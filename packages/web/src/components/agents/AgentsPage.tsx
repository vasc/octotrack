import { contracts } from "@octotrack/core/contracts";
import { useChoices } from "../../hooks/useChoices.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { useHome } from "../../hooks/useHome.ts";
import { usePush } from "../../hooks/usePush.ts";
import { rosterSummary } from "../../lib/format.ts";
import { lineWaitsOnYou } from "../../lib/lines.ts";
import { PushToggle } from "../home/PushToggle.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { Page } from "../ui/Page.tsx";
import { Notice } from "../ui/Notice.tsx";
import { AgentRoster } from "./AgentRoster.tsx";
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
  const facts = h.home.data?.lines ?? {};
  const roster = agents.data ?? [];
  return (
    <Page
      title="Agents"
      {...(roster.length === 0 ? {} : { subtitle: rosterSummary(roster.map((agent) => agent.state)) })}
      aside={
        <PushToggle
          state={push.state}
          error={push.error}
          onTurnOn={() => void push.turnOn()}
          onTurnOff={() => void push.turnOff()}
        />
      }
    >
      <Loaded
        loaded={agents.data !== undefined}
        error={agents.error}
        what="agents"
        onRetry={() => void agents.refetch()}
        at={agents.dataUpdatedAt}
      >
        {roster.length === 0 ? (
          <Notice title="No agent has checked in yet" command="export OCTO_AGENT=feature-x">
            An agent appears here the first time it runs an octo command with its name.
          </Notice>
        ) : (
          <AgentRoster
            agents={roster}
            row={(agent) => (
              <AgentRosterRow
                key={agent.name}
                busy={choices.waiting(`agent:${agent.name}`)}
                agent={agent}
                waitsOnYou={agent.lines.some((claim) => lineWaitsOnYou(facts, claim.line))}
                onStop={(name) => choices.make(contracts.agentStop.name, { name }, `Stopping ${name}`)}
                onLift={(name) => choices.make(contracts.agentLift.name, { name }, `Lifting ${name}'s stop`)}
                onRelease={(name) =>
                  choices.make(
                    contracts.agentRelease.name,
                    { name },
                    `Releasing ${name} from ${agent.lines.length === 1 ? "its line" : "its lines"}`,
                  )
                }
              />
            )}
          />
        )}
      </Loaded>
    </Page>
  );
}
