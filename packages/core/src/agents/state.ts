import type { Agent, AgentState } from "../schemas.ts";

/** A command, watch poll or push within this long means the agent is at work. */
export const RUNNING_WINDOW_MS = 15 * 60 * 1000;
/**
 * How long a wake's process may run, the woken session working within it, before the server ends it: past this it
 * holds a process for good. The server's wake dispatcher keeps to it; the cap counts a wake as running for no longer.
 */
export const WAKE_DEADLINE_MS = 30 * 60 * 1000;

/**
 * Where an agent stands, from what Octotrack has seen of it. Stopped and gone are things that happened; the rest follows
 * from its last command and whether it can be woken. Silence alone never ends anything: a quiet agent keeps its line.
 */
export function agentState(agent: Agent, now: string): AgentState {
  if (agent.stoppedAt !== null) return "stopped";
  if (agent.goneAt !== null) return "gone";
  if (Date.parse(now) - Date.parse(agent.lastSeenAt) <= RUNNING_WINDOW_MS) return "running";
  return agent.wakeAddress === null ? "quiet" : "asleep";
}

/** Reachable agents can be told something and act on it: running ones see their next reply, asleep ones are woken. */
export function isReachable(state: AgentState): boolean {
  return state === "running" || state === "asleep";
}

/** A name that reads as a ref (GARDEN-2, l-4) would be confused with one everywhere refs are recognised. */
export function looksLikeRef(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(name);
}

/** The name the developer acts under, from the dashboard or the CLI with --me. Tasks are issues assigned to it. */
export const DEVELOPER = "dev";

/**
 * Names that say who acted in the log without being agents: the developer, Octotrack itself, and pull request sync. An
 * agent under one of them would pass for it, so none may be used, by a new agent or an old one.
 */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([DEVELOPER, "octotrack", "github"]);

/**
 * A new agent's name: letters and digits of any language, dots, dashes and underscores, from a letter or
 * digit, at most 64. Names reach wake addresses and the developer's stop command, as one argument with no shell, so
 * nothing a glob or an option parser reads specially (`*`, a leading dash) may be in one.
 */
export function isAgentName(name: string): boolean {
  return /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]{0,62}[\p{L}\p{N}._-])?$/u.test(name);
}
