import { OctoError } from "../errors.ts";
import { getAgent } from "../store/agents.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { AgentRow } from "../store/rows.ts";
import { isAgentName, looksLikeRef, RESERVED_NAMES } from "./state.ts";

/** Said to a call with no name: never mentions --me, so that an agent is not taught to pass as the developer. */
function unnamed(): OctoError {
  return new OctoError(
    "invalid_input",
    "No agent name on this call: set your agent name",
    "Set OCTO_AGENT=<your name> in your environment, or pass --agent <your name>.",
  );
}

function freeName(ctx: Ctx, base: string): string {
  for (let n = 2; ; n += 1) {
    const candidate = `${base}.${n}`;
    if (getAgent(ctx, candidate) === null) return candidate;
  }
}

/**
 * Who an agent's call is from: a name plus its checkout. A name already used from another checkout, by an agent that is
 * not gone, is refused with a free name. A call with no name is the one agent using its checkout; reads with no name
 * stay anonymous, writes are refused. Returns the name, or null for an anonymous read.
 */
export function resolveAgent(
  ctx: Ctx,
  name: string,
  anonymous: boolean,
  checkout: string | null,
  writes: boolean,
): string | null {
  if (anonymous) {
    const users =
      checkout === null
        ? []
        : rows(ctx, AgentRow, "SELECT * FROM agents WHERE checkout = ? AND goneAt IS NULL", [checkout]);
    const [only, second] = users;
    if (only !== undefined && second === undefined) return only.name;
    if (second !== undefined) {
      throw new OctoError(
        "conflict",
        "two agents use this checkout; pass your name",
        `They are ${users.map((user) => user.name).join(" and ")}. Set OCTO_AGENT=<your name>, or pass --agent <your name>.`,
      );
    }
    if (writes) throw unnamed();
    return null;
  }
  if (RESERVED_NAMES.has(name.toLowerCase())) {
    throw new OctoError(
      "invalid_input",
      `"${name}" cannot be an agent's name: the log uses it for the developer or for Octotrack itself`,
      "Pick another name. The developer passes --me instead.",
    );
  }
  const existing = getAgent(ctx, name);
  if (existing === null) {
    // Agents named before this rule keep their names; new ones keep to it.
    if (!isAgentName(name)) {
      throw new OctoError(
        "invalid_input",
        `"${name}" cannot be an agent's name`,
        "Use letters, digits, dots, dashes, underscores and inner spaces, starting with a letter or digit, at most 64.",
      );
    }
    if (looksLikeRef(name)) {
      throw new OctoError(
        "invalid_input",
        `"${name}" reads as a ref, so it cannot be an agent's name`,
        "Pick another name.",
      );
    }
    return name;
  }
  if (
    checkout !== null &&
    existing.checkout !== null &&
    existing.checkout !== checkout &&
    existing.goneAt === null
  ) {
    throw new OctoError(
      "conflict",
      `${name} is already working in ${existing.checkout}`,
      `One name is one session in one checkout. Use another name, such as ${freeName(ctx, name)}.`,
    );
  }
  return name;
}

/** Writes from a stopped agent are refused, and never recorded or counted: the developer already knows. */
export function refuseIfStopped(ctx: Ctx, name: string): void {
  const agent = getAgent(ctx, name);
  if (agent === null || agent.stoppedAt === null) return;
  throw new OctoError(
    "forbidden",
    `The developer stopped ${name}${agent.stoppedReason === null ? "" : `: ${agent.stoppedReason}`}`,
    "Every write under your name is refused until the developer lifts the stop.",
  );
}
