import { contracts } from "@octotrack/core/contracts";
import { useChoices } from "../../hooks/useChoices.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { PageHead } from "../ui/PageHead.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { AgentRosterRow } from "./AgentRosterRow.tsx";
import { WatchRow } from "./WatchRow.tsx";

export function AgentsPage() {
  const agents = useOpQuery(contracts.agentList, {});
  const choices = useChoices();
  const lift = useOpMutation(contracts.agentLift);
  const watches = useOpQuery(contracts.watchList, {});
  const waiting = watches.data?.filter((watch) => watch.waiting) ?? [];
  const registered = watches.data?.filter((watch) => !watch.waiting) ?? [];
  return (
    <div className="page">
      <PageHead title="Agents" />
      {agents.isPending ? <LoadingState /> : null}
      {agents.error === null ? null : <ErrorState error={agents.error} />}
      {lift.error === null ? null : <ErrorState error={lift.error} />}
      <Section title="Roster" note={String(agents.data?.length ?? "")}>
        {agents.data?.length === 0 ? (
          <EmptyState command="export OCTO_AGENT=claude-feature-x">No agent has checked in yet.</EmptyState>
        ) : null}
        <div className="rows">
          {agents.data?.map((agent) => (
            <AgentRosterRow
              key={agent.name}
              agent={agent}
              onStop={(name) => choices.make(contracts.agentStop.name, { name }, `Stopped ${name}`)}
              onLift={(name) => lift.mutate({ name })}
            />
          ))}
        </div>
      </Section>
      <Section title="Waiting now" note={String(waiting.length)}>
        {waiting.length === 0 ? <p className="muted">No agent is hanging on anything.</p> : null}
        <div className="rows">
          {waiting.map((watch) => (
            <WatchRow key={watch.ref} watch={watch} />
          ))}
        </div>
      </Section>
      {registered.length === 0 ? null : (
        <Section title="Registered, not polling">
          <div className="rows">
            {registered.map((watch) => (
              <WatchRow key={watch.ref} watch={watch} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
