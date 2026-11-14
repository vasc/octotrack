import type { AgentView } from "@octotrack/core/schemas";
import { Badge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

const STATE_TONE = {
  running: "good",
  asleep: "neutral",
  quiet: "neutral",
  gone: "warn",
  stopped: "bad",
} as const;

/** One agent on the roster: what it is, where it is, and Stop, or Lift once stopped. */
export function AgentRosterRow({
  agent,
  onStop,
  onLift,
}: {
  agent: AgentView;
  onStop(name: string): void;
  onLift(name: string): void;
}) {
  return (
    <article className="row" aria-label={agent.name}>
      <div className="row-stack">
        <span className="strong">{agent.name}</span>
        <p className="home-meta">
          <span>{agent.repo ?? "no repo"}</span>
          {agent.line === null ? <span>on no line</span> : null}
          <span>{agent.wakeAddress === null ? "cannot be woken" : `wakes at ${agent.wakeAddress}`}</span>
          {agent.stoppedReason === null ? null : <span>stopped: {agent.stoppedReason}</span>}
          {agent.wakeError === null ? null : <span>last wake failed: {agent.wakeError}</span>}
        </p>
        {agent.note === null ? null : <span className="muted">{agent.note}</span>}
      </div>
      {agent.line === null ? null : (
        <span className="no-shrink">
          <RefLink value={agent.line} /> <span className="muted">{agent.role}</span>
        </span>
      )}
      <Badge tone={STATE_TONE[agent.state]}>{agent.state}</Badge>
      <span className="muted no-shrink">
        last command <TimeAgo iso={agent.lastSeenAt} />
      </span>
      {agent.state === "stopped" ? (
        <button
          type="button"
          className="btn"
          aria-label={`Lift ${agent.name}`}
          onClick={() => onLift(agent.name)}
        >
          Lift
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          aria-label={`Stop ${agent.name}`}
          onClick={() => onStop(agent.name)}
        >
          Stop
        </button>
      )}
    </article>
  );
}
