import type { ReactNode } from "react";
import type { AgentView } from "@octotrack/core/schemas";
import { dayWord, type Tone, whenText } from "../../lib/format.ts";
import { Mark } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Code, Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Cell } from "../ui/Table.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";
import type { IconName } from "../ui/Icon.tsx";

/** "owner of L-59", or "on L-59" for a claim with no role. */
function claim(agent: AgentView, line: string): ReactNode {
  return (
    <>
      {agent.role === null ? "on " : `${agent.role} of `}
      <RefLink value={line} />
    </>
  );
}

/** What an agent is doing now, in a few words, as the Agents drawing writes it. */
function nowWords(agent: AgentView, waitsOnYou: boolean): ReactNode {
  // How it is woken matters only while it sleeps.
  const wakes = wakeScheme(agent);
  const reach = wakes === null ? "" : ` · wakes by ${wakes}`;
  switch (agent.state) {
    case "stopped": {
      const when = agent.stoppedAt === null ? "" : ` ${whenText(agent.stoppedAt)}`;
      return `stopped${when}${agent.stoppedReason === null ? "" : `: “${agent.stoppedReason}”`}`;
    }
    case "gone":
      if (agent.wakeError !== null) return `gone: its wake failed (${agent.wakeError})`;
      return agent.lastLine === null ? (
        "gone"
      ) : (
        <>
          gone, last owner of <RefLink value={agent.lastLine} />
        </>
      );
    case "quiet":
      return agent.line === null ? (
        "quiet"
      ) : (
        <>
          quiet, still holding <RefLink value={agent.line} />
        </>
      );
    default:
      if (agent.line === null) {
        return agent.state === "running"
          ? "idle: nothing to take or scope in its repo"
          : `${agent.state}, on no line`;
      }
      return (
        <>
          {agent.state}, {claim(agent, agent.line)}
          {waitsOnYou ? "; its line waits on you" : agent.state === "asleep" ? reach : ""}
        </>
      );
  }
}

/** How a session Octotrack started, which has run no command, went: "started for L-46; exits at once (exit 127)". */
function startWords(start: NonNullable<AgentView["start"]>, now: number): ReactNode {
  const exit = start.exitCode === null ? "" : ` (exit ${start.exitCode})`;
  const how = (() => {
    switch (start.state) {
      case "starting":
      case "running":
        return "starting";
      case "failed":
        return start.attempts > 1
          ? `exits at once${exit}, retried since ${dayWord(start.since, now)}`
          : `exited at once${exit}`;
      case "never_took":
        return "ran but never took its line";
      case "exited":
        return `exited${exit}`;
    }
  })();
  return (
    <>
      started for <RefLink value={start.line} />; {how}
    </>
  );
}

/** Each state's mark and tone, so that it never rests on colour alone. */
const STATE_MARK: Readonly<Record<AgentView["state"], readonly [IconName, Tone]>> = {
  running: ["dot", "good"],
  asleep: ["half", "neutral"],
  quiet: ["ring", "neutral"],
  stopped: ["square", "bad"],
  gone: ["cross", "neutral"],
};

/** A start still on its way is moving; one that failed or never took is stuck, marked with the triangle. */
function startMark(start: NonNullable<AgentView["start"]>): readonly [IconName, Tone] {
  return start.state === "starting" || start.state === "running" ? ["half", "info"] : ["alert", "warn"];
}

/** The kind of session a wake address reaches, if it has one. */
function wakeScheme(agent: AgentView): string | null {
  if (agent.wakeAddress === null) return null;
  return agent.wakeAddress.split(":")[0] ?? agent.wakeAddress;
}

/** The one thing the developer can do to an agent: Release a quiet one holding a line, Lift a stop, or Stop it. */
function AgentAction({
  agent,
  busy,
  onStop,
  onLift,
  onRelease,
}: {
  agent: AgentView;
  /** Its choice waits with Undo: the button says it is on its way. */
  busy: boolean;
  onStop(name: string): void;
  onLift(name: string): void;
  onRelease(name: string): void;
}) {
  if (agent.state === "gone") return null;
  if (agent.state === "quiet" && agent.line !== null) {
    return (
      <Button
        aria-label={busy ? `Releasing ${agent.name}` : `Release ${agent.name} from ${agent.line}`}
        busy={busy ? "Releasing…" : undefined}
        onClick={() => onRelease(agent.name)}
      >
        Release
      </Button>
    );
  }
  if (agent.state === "stopped") {
    return (
      <Button
        aria-label={busy ? `Lifting ${agent.name}` : `Lift ${agent.name}`}
        busy={busy ? "Lifting…" : undefined}
        onClick={() => onLift(agent.name)}
      >
        Lift
      </Button>
    );
  }
  return (
    <Button
      aria-label={busy ? `Stopping ${agent.name}` : `Stop ${agent.name}`}
      busy={busy ? "Stopping…" : undefined}
      onClick={() => onStop(agent.name)}
    >
      Stop
    </Button>
  );
}

/**
 * One agent on the roster, a row of its table: its name, its repo's key, what it is doing now with a glyph, when it was
 * last seen, and the one thing to do to it.
 */
export function AgentRosterRow({
  agent,
  waitsOnYou = false,
  busy = false,
  now = Date.now(),
  onStop,
  onLift,
  onRelease,
}: {
  agent: AgentView;
  /** Its line has questions or tasks waiting on the developer. */
  waitsOnYou?: boolean;
  /** A Stop, Lift or Release of it waits with Undo. */
  busy?: boolean;
  now?: number;
  onStop(name: string): void;
  onLift(name: string): void;
  onRelease(name: string): void;
}) {
  const [mark, tone] = agent.start === null ? STATE_MARK[agent.state] : startMark(agent.start);
  return (
    <tr aria-label={agent.name}>
      <Cell place="lead">{agent.name}</Cell>
      <Cell place="fact">{agent.repo === null ? null : <Code>{agent.repo}</Code>}</Cell>
      <Cell place="main">
        <Mark tone={tone} icon={mark} />
        <span>{agent.start === null ? nowWords(agent, waitsOnYou) : startWords(agent.start, now)}</span>
        {agent.note === null ? null : <Note>{agent.note}</Note>}
      </Cell>
      <Cell place="fact">
        {agent.start === null ? <TimeAgo iso={agent.lastSeenAt} now={now} /> : "never"}
      </Cell>
      <Cell place="trailing">
        <AgentAction agent={agent} busy={busy} onStop={onStop} onLift={onLift} onRelease={onRelease} />
      </Cell>
    </tr>
  );
}
