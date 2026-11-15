import { homeLines, lineFacts } from "../../lib/lines.ts";
import { contracts } from "@octotrack/core/contracts";
import { useChoices } from "../../hooks/useChoices.ts";
import { useHome } from "../../hooks/useHome.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { usePush } from "../../hooks/usePush.ts";
import { PushToggle } from "../home/PushToggle.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { AgentRosterRow } from "./AgentRosterRow.tsx";

/**
 * Who is out there, and where, as E-Agents draws it. The only actions are Stop, Lift on a stopped agent, and Release
 * on a quiet one; what needs the developer is on Lines.
 */
export function AgentsPage() {
  const agents = useOpQuery(contracts.agentList, {});
  const push = usePush();
  const choices = useChoices();
  const h = useHome();
  const home = h.home.data;
  const lines = homeLines(home);
  const facts = (ref: string | null) => lineFacts(lines, home?.lines ?? {}, ref);
  return (
    <div className="page">
      <div className="log-head">
        <div>
          <h1 className="panel-title">Agents</h1>
          <p className="log-sub">
            Who is out there, and where. The only action here is Stop, which becomes Lift on a stopped agent;
            what needs you is on Lines.
          </p>
        </div>
        <PushToggle state={push.state} error={push.error} onTurnOn={() => void push.turnOn()} />
      </div>
      {agents.isPending ? <LoadingState /> : null}
      {agents.error === null ? null : <ErrorState error={agents.error} />}
      {choices.failure === null ? null : <ErrorState error={choices.failure} />}
      {agents.data?.length === 0 ? (
        <EmptyState command="export OCTO_AGENT=feature-x">No agent has checked in yet.</EmptyState>
      ) : (
        <div className="table-box">
          <table className="agents-table" aria-label="Roster">
            <thead>
              <tr>
                <th scope="col">Agent</th>
                <th scope="col">Repo</th>
                <th scope="col">Line</th>
                <th scope="col">Last command</th>
                <th scope="col">Wake</th>
                <th scope="col">Now</th>
                <th scope="col">
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.data?.map((agent) => (
                <AgentRosterRow
                  key={agent.name}
                  agent={agent}
                  {...(agent.repo === null ? {} : { repo: h.repoName(agent.repo) })}
                  {...facts(agent.line ?? agent.start?.line ?? agent.lastLine)}
                  onStop={(name) => choices.make(contracts.agentStop.name, { name }, `Stopping ${name}`)}
                  onLift={(name) =>
                    choices.make(contracts.agentLift.name, { name }, `Lifting ${name}'s stop`)
                  }
                  onRelease={(name) =>
                    choices.make(contracts.agentRelease.name, { name }, `Releasing ${name} from its line`)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="agents-notes">
        <p>
          <b>States.</b> Running: a command, poll or push in the last 15 minutes. Asleep: not running, with a
          wake address. Quiet: neither, shown with its last command and Release. Gone: a wake failed, or a
          session Octotrack started exited with no wake address. Stopped: by you, or by Octotrack after three
          writes a line's state forbids.
        </p>
        <p>
          <b>Taking.</b> <span className="mono">line take L-7</span> makes it owner, else helper, else says
          why; never another line. Bare, it finds the highest working line in its repo with no owner, else a
          helper's place, else scoping. On its own line it gets its next issue, or is told why there is none.
        </p>
        <p>
          <b>Keeping.</b> Claims end on release, Stop, a failed wake, or the exit of a session Octotrack
          started; never on a timer, since a line can run for weeks. The full rules are three tables in the
          design doc.
        </p>
      </div>
    </div>
  );
}
