import type { AgentView } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { AUTO_STOP_REASON } from "@octotrack/core/schemas";
import { dayWord, whenText } from "../../lib/format.ts";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** What an agent is doing now, in a few words, as E-Agents writes it. */
function nowText(agent: AgentView, waitsOnYou: boolean): string {
  if (waitsOnYou && agent.line !== null && (agent.state === "running" || agent.state === "asleep")) {
    return `${agent.state}; its line waits on you`;
  }
  switch (agent.state) {
    case "stopped": {
      const when = agent.stoppedAt === null ? "" : ` ${whenText(agent.stoppedAt)}`;
      if (agent.stoppedReason === AUTO_STOP_REASON) {
        return `stopped by Octotrack${when}, after 3 writes a line's state forbids`;
      }
      return `stopped by you${when}${agent.stoppedReason === null ? "" : `: ${agent.stoppedReason}`}`;
    }
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

/** How a session Octotrack started, which has run no command, went: E-Agents' "retried since Tuesday, each exits at once". */
function startText(start: NonNullable<AgentView["start"]>, now: number): string {
  const exit = start.exitCode === null ? "" : ` (exit ${start.exitCode})`;
  switch (start.state) {
    case "starting":
    case "running":
      return "starting";
    case "failed":
      return start.attempts > 1
        ? `retried since ${dayWord(start.since, now)}, each exits at once${exit}`
        : `exited at once${exit}`;
    case "never_took":
      return "ran but never took its line";
    case "exited":
      return `exited${exit}`;
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
  now = Date.now(),
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
  now?: number;
  onStop(name: string): void;
  onLift(name: string): void;
  onRelease(name: string): void;
}) {
  // The line it is on; else the one it was started for, or the one it last owned, each said as such.
  const shown = agent.line ?? agent.start?.line ?? agent.lastLine;
  const relation =
    agent.line !== null
      ? agent.role === null
        ? ""
        : `, ${agent.role}`
      : agent.start !== null
        ? ", started for it"
        : ", last owner";
  return (
    <tr aria-label={agent.name} data-state={agent.state}>
      <th scope="row">{agent.name}</th>
      <td className="mono agent-repo">{repo ?? agent.repo ?? "none"}</td>
      <td className="agent-line">
        {shown === null ? (
          <span className="muted">no line</span>
        ) : (
          <>
            <button type="button" className="line-link mono" onClick={() => openEntity(shown)}>
              {shown}
            </button>
            {lineTitle === undefined ? null : <> {lineTitle}</>}
            <span className="muted">{relation}</span>
          </>
        )}
      </td>
      <td className="muted agent-last">
        {agent.start === null ? <TimeAgo iso={agent.lastSeenAt} /> : "never"}
      </td>
      <td className="muted agent-wake">{wakeText(agent)}</td>
      <td className="agent-now">
        {agent.start === null ? nowText(agent, waitsOnYou) : startText(agent.start, now)}
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
