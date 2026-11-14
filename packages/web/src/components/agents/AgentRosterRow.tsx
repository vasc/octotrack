import type { AgentView } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** What an agent is doing now, in a few words, as E-Agents writes it. */
function nowText(agent: AgentView, waitsOnYou: boolean): string {
  if (waitsOnYou && agent.line !== null && (agent.state === "running" || agent.state === "asleep")) {
    return `${agent.state}; its line waits on you`;
  }
  switch (agent.state) {
    case "stopped":
      return agent.stoppedReason === null ? "stopped" : `stopped: ${agent.stoppedReason}`;
    case "gone":
      return agent.wakeError === null ? "gone" : `gone: its wake failed (${agent.wakeError})`;
    case "quiet":
      return agent.line === null ? "quiet" : "quiet, still holding its line";
    default:
      return agent.line === null
        ? agent.state === "running"
          ? "idle: nothing to take or scope in its repo"
          : `${agent.state}, on no line`
        : `${agent.state}, on its line`;
  }
}

/** The kind of session a wake address reaches, or none. */
function wakeText(agent: AgentView): string {
  if (agent.wakeAddress === null) return "none";
  return agent.wakeAddress.split(":")[0] ?? agent.wakeAddress;
}

/**
 * One agent on the roster: its repo, its line and role, its last command, how it is woken, what it is doing; Stop,
 * Lift on a stopped one, and Release on a quiet one that still holds a line.
 */
export function AgentRosterRow({
  agent,
  repo,
  lineTitle,
  waitsOnYou = false,
  onStop,
  onLift,
  onRelease,
}: {
  agent: AgentView;
  /** Its repo by GitHub name where one is set. */
  repo?: string;
  /** The title of the line it is on. */
  lineTitle?: string;
  /** Its line has questions or tasks waiting on the developer. */
  waitsOnYou?: boolean;
  onStop(name: string): void;
  onLift(name: string): void;
  onRelease(name: string): void;
}) {
  return (
    <tr aria-label={agent.name} data-state={agent.state}>
      <th scope="row">{agent.name}</th>
      <td className="mono">{repo ?? agent.repo ?? "none"}</td>
      <td>
        {agent.line === null ? (
          <span className="muted">none</span>
        ) : (
          <>
            <button type="button" className="line-link mono" onClick={() => openEntity(agent.line ?? "")}>
              {agent.line}
            </button>
            {lineTitle === undefined ? null : <> {lineTitle}</>}
            {agent.role === null ? null : <span className="muted">, {agent.role}</span>}
          </>
        )}
      </td>
      <td className="muted">
        <TimeAgo iso={agent.lastSeenAt} />
      </td>
      <td className="muted">{wakeText(agent)}</td>
      <td className="agent-now">
        {nowText(agent, waitsOnYou)}
        {agent.note === null ? null : <span className="agent-note">{agent.note}</span>}
      </td>
      <td className="agent-actions">
        {agent.state === "quiet" && agent.line !== null ? (
          <button
            type="button"
            className="btn"
            aria-label={`Release ${agent.name} from ${agent.line}`}
            onClick={() => onRelease(agent.name)}
          >
            Release
          </button>
        ) : null}
        {agent.state === "stopped" ? (
          <button
            type="button"
            className="btn"
            aria-label={`Lift ${agent.name}`}
            onClick={() => onLift(agent.name)}
          >
            Lift
          </button>
        ) : agent.state === "gone" ? null : (
          <button
            type="button"
            className="btn"
            aria-label={`Stop ${agent.name}`}
            onClick={() => onStop(agent.name)}
          >
            Stop
          </button>
        )}
      </td>
    </tr>
  );
}
