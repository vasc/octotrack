import type { Agent, AgentState } from "../schemas.ts";

/** A command, watch poll or push within this long means the agent is at work. */
export const RUNNING_WINDOW_MS = 15 * 60 * 1000;

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
