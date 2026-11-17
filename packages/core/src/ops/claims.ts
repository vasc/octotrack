import { z } from "zod";
import { endClaim, NOT_BLOCKED, setClaim, windingDown } from "../agents/claims.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import {
  type Agent,
  type ClaimRole,
  currentStep,
  type EntitySummary,
  type Line,
  type TakeResult,
} from "../schemas.ts";
import { addNotice, claimOf, claimsOn, getAgent, viewOf } from "../store/agents.ts";
import { emit } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, placeholders, rows } from "../store/context.ts";
import { allLines, getIssue, requireLine, requireProject, summarize } from "../store/entities.ts";
import { IssueRow, PlanStepRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { staleHeldOn } from "./tasks.ts";
import { requireDeveloper } from "./developer.ts";

const CountRow = z.object({ n: z.number() });

function requireSelf(ctx: Ctx): Agent {
  if (ctx.developer) {
    throw new OctoError(
      "invalid_input",
      "The developer is not an agent",
      "Agents run this with their own name.",
    );
  }
  const agent = getAgent(ctx, ctx.actor);
  if (agent === null) throw new OctoError("internal", `Agent ${ctx.actor} is not registered`);
  return agent;
}

function requireAgent(ctx: Ctx, name: string): Agent {
  const agent = getAgent(ctx, name);
  if (agent === null) throw new OctoError("not_found", `No agent called ${name}`, "Run octo agent list.");
  return agent;
}

/**
 * Work on a line for this agent, in plan order: an open issue, unclaimed, not blocked by anything unfinished, in a repo
 * it may claim in (an owner, any repo its line names; a helper, its own).
 */
function nextIssue(ctx: Ctx, line: Line, role: ClaimRole, agent: Agent): EntitySummary | null {
  const repos = role === "owner" ? line.repos : agent.repo === null ? [] : [agent.repo];
  if (repos.length === 0 || role === "scoper") return null;
  const [issue] = rows(
    ctx,
    IssueRow,
    `SELECT * FROM issues i WHERE i.line = ? AND i.status IN ('todo', 'backlog') AND i.assignee IS NULL
       AND i.project IN (${placeholders(repos)})
       AND ${NOT_BLOCKED}
     ORDER BY i.step IS NULL, i.step, i.createdAt LIMIT 1`,
    [line.ref, ...repos],
  );
  return issue === undefined ? null : summarize({ kind: "issue", value: issue });
}

/** What an owner with no issue to pick up should do: plan, break the current step into issues, or wait. */
function ownerWithoutWork(ctx: Ctx, line: Line): string {
  const steps = rows(ctx, PlanStepRow, "SELECT * FROM plan_steps WHERE line = ? ORDER BY position", [
    line.ref,
  ]);
  const current = currentStep(steps);
  if (current === undefined) {
    return `${line.ref} has no plan step left: write its plan (octo plan set ${line.ref}), or propose done.`;
  }
  const open = one(
    ctx,
    CountRow,
    "SELECT COUNT(*) AS n FROM issues WHERE line = ? AND step = ? AND status NOT IN ('done', 'cancelled')",
    [line.ref, current.position],
  );
  return (open?.n ?? 0) === 0
    ? `On ${line.ref}, break step ${current.position} into issues, mark it done (octo plan step ${line.ref} ${current.position} done), or propose done: ${current.title}`
    : `Nothing for you on ${line.ref} right now; you will be woken.`;
}

function result(ctx: Ctx, line: Line, role: ClaimRole, agent: Agent): TakeResult {
  if (role === "scoper") {
    return {
      line,
      role,
      next: null,
      message: `Scope ${line.ref}: its done when, plan, questions and tasks. When it is ready: octo line release.`,
    };
  }
  const next = nextIssue(ctx, line, role, agent);
  if (next !== null) {
    return { line, role, next, message: `Work on ${next.ref}: ${next.title}${lastHeld(ctx, next.ref)}` };
  }
  return {
    line,
    role,
    next: null,
    message: role === "owner" ? ownerWithoutWork(ctx, line) : "Nothing for you here.",
  };
}

/** Who held an issue before it came back to the line, so its next holder can find their branch. */
function lastHeld(ctx: Ctx, ref: string): string {
  const issue = getIssue(ctx, ref);
  if (issue === null || issue.lastAssignee === null) return "";
  return ` (last held by ${issue.lastAssignee} until ${issue.lastAssignedAt ?? "recently"}; look for their branch)`;
}

/** An owner that comes back to a line someone else now owns helps, and hears what became of the issues it held. */
function backAsHelper(ctx: Ctx, agent: string, line: Line): string {
  const lost = rows(
    ctx,
    IssueRow,
    "SELECT * FROM issues WHERE line = ? AND lastAssignee = ? AND status NOT IN ('done', 'cancelled')",
    [line.ref, agent],
  );
  if (lost.length === 0) return "";
  const held = lost.map(
    (issue) => `${issue.ref} (${issue.assignee === null ? "free" : `held by ${issue.assignee}`})`,
  );
  return ` You owned ${line.ref} before; it has an owner now, so you help. The issues you held: ${held.join(", ")}.`;
}

function hasOwner(ctx: Ctx, line: Line): boolean {
  return claimsOn(ctx, line.ref).some((claim) => claim.role === "owner");
}

function isUnscoped(ctx: Ctx, line: Line): boolean {
  return line.scopedAt === null && !claimsOn(ctx, line.ref).some((claim) => claim.role === "scoper");
}

/** Where an agent with no line belongs, in the developer's order: owner, then helper where there is work, then scoper. */
function findLine(
  ctx: Ctx,
  agent: Agent,
  exclude: string | null,
  scoping: boolean,
): { line: Line; role: ClaimRole } | null {
  const repo = agent.repo;
  if (repo === null) return null;
  const mine = (line: Line) =>
    line.ref !== exclude && line.ownedBy === null && line.repos.includes(repo) && !windingDown(line, ctx.now);
  const working = allLines(ctx, "WHERE state = 'working'").filter(mine);
  const unowned = working.find((line) => !hasOwner(ctx, line));
  if (unowned !== undefined) return { line: unowned, role: "owner" };
  const withWork = working.find((line) => nextIssue(ctx, line, "helper", agent) !== null);
  if (withWork !== undefined) return { line: withWork, role: "helper" };
  if (!scoping) return null;
  const toScope = allLines(ctx, "WHERE state = 'up_next'")
    .filter(mine)
    .find((line) => isUnscoped(ctx, line));
  return toScope === undefined ? null : { line: toScope, role: "scoper" };
}

function claimLine(ctx: Ctx, agent: Agent, line: Line, role: ClaimRole): TakeResult {
  const current = claimOf(ctx, agent.name);
  if (current !== null && current.line !== line.ref) endClaim(ctx, agent.name, "switch");
  setClaim(ctx, agent.name, line, role);
  // Only what is held waits for it: an old question that reaches the developer already needs nobody's word.
  const stale = staleHeldOn(ctx, line.ref);
  if (stale.length > 0) {
    addNotice(
      ctx,
      agent.name,
      "held_stale",
      line.ref,
      `Held on ${line.ref} for more than 7 days, so it does not reach the developer until you re-confirm or withdraw: ${stale.join(", ")}. Re-confirm with octo held confirm <REF>.`,
      false,
    );
  }
  const taken = result(ctx, requireLine(ctx, line.ref), role, agent);
  return role === "helper"
    ? { ...taken, message: `${taken.message}${backAsHelper(ctx, agent.name, line)}` }
    : taken;
}

function nothing(agent: Agent): TakeResult {
  return {
    line: null,
    role: null,
    next: null,
    message:
      agent.repo === null
        ? "Say which repo you serve first: octo agent register --repo <KEY>."
        : `Nothing to take in ${agent.repo} right now. Replies to your commands will say when a line needs you.`,
  };
}

/** Which role a named line would give this agent, or why it cannot have it. Refusals here never count. */
function roleOn(ctx: Ctx, agent: Agent, line: Line): ClaimRole {
  if (line.ownedBy !== null) {
    throw new OctoError(
      "conflict",
      `${line.ref} is the developer's own; it goes back to agents when they hand it over`,
    );
  }
  if (line.repos.length === 0) {
    throw new OctoError("conflict", `${line.ref} names no repo, so there is nowhere to work on it`);
  }
  if (windingDown(line, ctx.now)) {
    throw new OctoError("conflict", `${line.ref} is winding down; take it once its agents have wrapped up`);
  }
  if (agent.repo === null) {
    throw new OctoError("conflict", "Say which repo you serve first", "octo agent register --repo <KEY>");
  }
  if (line.repos.length > 0 && !line.repos.includes(agent.repo)) {
    throw new OctoError(
      "conflict",
      `${line.ref} is for ${line.repos.join(", ")}; you serve ${agent.repo}`,
      "Run octo line take with no ref for a line in your repo.",
    );
  }
  if (line.state === "working") return hasOwner(ctx, line) ? "helper" : "owner";
  if (line.state === "up_next") {
    if (line.scopedAt !== null) throw new OctoError("conflict", `${line.ref} is already scoped`);
    const scoper = claimsOn(ctx, line.ref).find((claim) => claim.role === "scoper");
    if (scoper !== undefined) throw new OctoError("conflict", `${scoper.agent} is scoping ${line.ref}`);
    return "scoper";
  }
  throw new OctoError(
    "conflict",
    `${line.ref} is ${line.state.replace("_", " ")}; only lines being worked on, or up next to scope, can be taken`,
    "Run octo line take with no ref for a line in your repo.",
  );
}

function takeOwnLine(ctx: Ctx, agent: Agent, line: Line, role: ClaimRole): TakeResult {
  if (role === "owner") return result(ctx, line, role, agent);
  if (role === "helper") {
    const here = result(ctx, line, role, agent);
    if (here.next !== null) return here;
    endClaim(ctx, agent.name, "release");
    const elsewhere = findLine(ctx, agent, line.ref, true);
    return elsewhere === null ? nothing(agent) : claimLine(ctx, agent, elsewhere.line, elsewhere.role);
  }
  const work = findLine(ctx, agent, line.ref, false);
  return work === null ? result(ctx, line, role, agent) : claimLine(ctx, agent, work.line, work.role);
}

export const claimOps = [
  bind(contracts.agentRegister, (ctx, input) => {
    const agent = requireSelf(ctx);
    if (input.wake !== undefined)
      ctx.sql.run("UPDATE agents SET wakeAddress = ? WHERE name = ?", [input.wake, agent.name]);
    if (input.repo !== undefined) {
      const repo = requireProject(ctx, input.repo).ref;
      // Named once: an agent that could change its repo could step outside what it may take and claim.
      if (agent.repo !== null && agent.repo !== repo) {
        throw new OctoError(
          "forbidden",
          `${agent.name} serves ${agent.repo}`,
          "An agent names its repo once. Work in another repo is another session, with its own name.",
        );
      }
      ctx.sql.run("UPDATE agents SET repo = ? WHERE name = ?", [repo, agent.name]);
    }
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentStop, (ctx, input) => {
    requireDeveloper(ctx, "stop an agent");
    const agent = requireAgent(ctx, input.name);
    const reason = input.reason ?? null;
    ctx.sql.run("UPDATE agents SET stoppedAt = ?, stoppedReason = ? WHERE name = ?", [
      ctx.now,
      reason,
      agent.name,
    ]);
    const claim = endClaim(ctx, agent.name, "stop");
    addNotice(
      ctx,
      agent.name,
      "stop",
      claim?.line ?? null,
      `The developer stopped you${reason === null ? "" : `: ${reason}`}. Every write under your name is refused until they lift it.`,
      false,
    );
    emit(ctx, {
      type: "agent.stopped",
      kind: "agent",
      ref: agent.name,
      project: agent.repo,
      line: claim?.line ?? null,
      summary: `${agent.name} stopped${reason === null ? "" : `: ${reason}`}`,
      attrs: { channel: ctx.channel, ...(ctx.said === null ? {} : { said: ctx.said }) },
    });
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentRelease, (ctx, input) => {
    requireDeveloper(ctx, "release an agent's line");
    const agent = requireAgent(ctx, input.name);
    const claim = endClaim(ctx, agent.name, "released");
    if (claim !== null) {
      addNotice(
        ctx,
        agent.name,
        "released",
        claim.line,
        `The developer released you from ${claim.line}; its issues went back to the line. Run octo line take for what to do next.`,
        true,
      );
    }
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentLift, (ctx, input) => {
    requireDeveloper(ctx, "lift a stop");
    const agent = requireAgent(ctx, input.name);
    ctx.sql.run("UPDATE agents SET stoppedAt = NULL, stoppedReason = NULL, stopRanAt = NULL WHERE name = ?", [
      agent.name,
    ]);
    emit(ctx, {
      type: "agent.lifted",
      kind: "agent",
      ref: agent.name,
      project: agent.repo,
      summary: `${agent.name} may write again`,
      attrs: { channel: ctx.channel },
    });
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.lineTake, (ctx, input) => {
    const agent = requireSelf(ctx);
    const current = claimOf(ctx, agent.name);
    if (input.ref === undefined) {
      if (current !== null) return takeOwnLine(ctx, agent, requireLine(ctx, current.line), current.role);
      const found = findLine(ctx, agent, null, true);
      return found === null ? nothing(agent) : claimLine(ctx, agent, found.line, found.role);
    }
    const line = requireLine(ctx, input.ref);
    if (current !== null && current.line === line.ref) return takeOwnLine(ctx, agent, line, current.role);
    return claimLine(ctx, agent, line, roleOn(ctx, agent, line));
  }),

  bind(contracts.lineRelease, (ctx) => {
    const agent = requireSelf(ctx);
    return { line: endClaim(ctx, agent.name, "release")?.line ?? null };
  }),
];
