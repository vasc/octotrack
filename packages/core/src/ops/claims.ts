import { z } from "zod";
import { endClaim, endClaims, NOT_BLOCKED, setClaim, windingDown } from "../agents/claims.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import {
  type Agent,
  type ClaimRole,
  currentStep,
  type EntitySummary,
  type Line,
  type PlanBranch,
  type TakeResult,
} from "../schemas.ts";
import { addNotice, claimOn, claimsOf, claimsOn, getAgent, onlyLineOf, viewOf } from "../store/agents.ts";
import { emit } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, placeholders, rows } from "../store/context.ts";
import { allLines, getIssue, requireLine, requireProject, summarize } from "../store/entities.ts";
import { IssueRow } from "../store/rows.ts";
import { waitsOn } from "../plan.ts";
import { loadPlan } from "./plan.ts";
import { bind } from "./bind.ts";
import { staleHeldOn } from "./tasks.ts";

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

/** Who made a change, as a notice names them: the developer, or the agent by its name. */
function whoDid(ctx: Ctx): string {
  return ctx.developer ? "The developer" : ctx.actor;
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
     ORDER BY i.step IS NULL, (SELECT s.ord FROM plan_steps s WHERE s.id = i.step), i.createdAt LIMIT 1`,
    [line.ref, ...repos],
  );
  return issue === undefined ? null : summarize({ kind: "issue", value: issue });
}

/**
 * What an owner with no issue to pick up should do: plan, break a current step into issues, or wait. A current step
 * that waits on open branches is not the job: those branches' current steps are, first; then the critical path's current
 * step, when nothing holds it up; then the current step of each other open branch, in the tree's order.
 */
function ownerWithoutWork(ctx: Ctx, line: Line): string {
  const plan = loadPlan(ctx, line.ref);
  const current = currentStep(plan.steps.filter((step) => step.branch === null));
  if (current === undefined) {
    return `${line.ref} has no plan step left: write its plan (octo plan set ${line.ref}), or propose done.`;
  }
  const open = plan.branches.filter((branch) => branch.state === "open");
  const holding = open.filter((branch) => branch.holdsUp === current.address);
  const currentOf = (branches: readonly PlanBranch[]) =>
    branches
      .filter((branch) => branch.became === null)
      .flatMap((branch) => {
        const step = currentStep(plan.steps.filter((candidate) => candidate.branch === branch.id));
        return step === undefined ? [] : [step];
      });
  const candidates = [
    ...currentOf(holding),
    ...(holding.length === 0 ? [current] : []),
    ...currentOf(open.filter((branch) => !holding.includes(branch))),
  ];
  const bare = candidates.find((step) => {
    const work = one(
      ctx,
      CountRow,
      "SELECT COUNT(*) AS n FROM issues WHERE line = ? AND step = ? AND status NOT IN ('done', 'cancelled')",
      [line.ref, step.id],
    );
    return (work?.n ?? 0) === 0;
  });
  if (bare !== undefined) {
    return `On ${line.ref}, break step ${bare.address} into issues, mark it done (octo plan step ${line.ref} ${bare.address} done), or propose done: ${bare.title}`;
  }
  const waits = waitsOn(current, plan.branches);
  return waits.length === 0
    ? `Nothing for you on ${line.ref} right now; you will be woken.`
    : `Nothing for you on ${line.ref} right now: step ${current.address} waits on ${waits.join(" and ")}; you will be woken.`;
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

/**
 * Where an agent belongs next, in the developer's order: owner, then helper where there is work, then scoper; never a
 * line it is on already or the one it just left.
 */
function findLine(
  ctx: Ctx,
  agent: Agent,
  exclude: string | null,
  scoping: boolean,
): { line: Line; role: ClaimRole } | null {
  const repo = agent.repo;
  if (repo === null) return null;
  const on = new Set(claimsOf(ctx, agent.name).map((claim) => claim.line));
  const mine = (line: Line) =>
    line.ref !== exclude &&
    !on.has(line.ref) &&
    line.ownedBy === null &&
    line.repos.includes(repo) &&
    !windingDown(line, ctx.now);
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

/** Puts the agent on a line as well as any it is on already. */
function claimLine(ctx: Ctx, agent: Agent, line: Line, role: ClaimRole): TakeResult {
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

/**
 * Which role a named line gives this agent: on a line being worked on, owner, or helper when it has one; on any other
 * line, scoper, unless another agent is scoping it already, since two scopers would write over each other's plan.
 */
function roleOn(ctx: Ctx, line: Line): ClaimRole {
  if (line.state === "working") return hasOwner(ctx, line) ? "helper" : "owner";
  const scoper = claimsOn(ctx, line.ref).find((claim) => claim.role === "scoper");
  if (scoper !== undefined) throw new OctoError("conflict", `${scoper.agent} is scoping ${line.ref}`);
  return "scoper";
}

function takeOwnLine(ctx: Ctx, agent: Agent, line: Line, role: ClaimRole): TakeResult {
  if (role === "owner") return result(ctx, line, role, agent);
  if (role === "helper") {
    const here = result(ctx, line, role, agent);
    if (here.next !== null) return here;
    endClaim(ctx, agent.name, line.ref, "release");
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
      ctx.sql.run("UPDATE agents SET repo = ? WHERE name = ?", [repo, agent.name]);
    }
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentStop, (ctx, input) => {
    const agent = requireAgent(ctx, input.name);
    const reason = input.reason ?? null;
    ctx.sql.run("UPDATE agents SET stoppedAt = ?, stoppedReason = ? WHERE name = ?", [
      ctx.now,
      reason,
      agent.name,
    ]);
    const left = endClaims(ctx, agent.name, "stop");
    const first = left[0]?.line ?? null;
    addNotice(
      ctx,
      agent.name,
      "stop",
      first,
      `${whoDid(ctx)} stopped you${reason === null ? "" : `: ${reason}`}. Every write under your name is refused until it is lifted.`,
      false,
    );
    emit(ctx, {
      type: "agent.stopped",
      kind: "agent",
      ref: agent.name,
      project: agent.repo,
      line: first,
      summary: `${agent.name} stopped${reason === null ? "" : `: ${reason}`}${left.length > 1 ? `, leaving ${left.map((claim) => claim.line).join(", ")}` : ""}`,
      attrs: { channel: ctx.channel, ...(ctx.said === null ? {} : { said: ctx.said }) },
    });
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentRelease, (ctx, input) => {
    const agent = requireAgent(ctx, input.name);
    const left =
      input.line === undefined
        ? endClaims(ctx, agent.name, "released")
        : [endClaim(ctx, agent.name, requireLine(ctx, input.line).ref, "released")].flatMap((claim) =>
            claim === null ? [] : [claim],
          );
    for (const claim of left) {
      addNotice(
        ctx,
        agent.name,
        "released",
        claim.line,
        `${whoDid(ctx)} released you from ${claim.line}; its issues went back to the line. Run octo line take for what to do next.`,
        true,
      );
    }
    return viewOf(ctx, requireAgent(ctx, agent.name));
  }),

  bind(contracts.agentLift, (ctx, input) => {
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
    if (input.ref === undefined) {
      const claims = claimsOf(ctx, agent.name);
      if (claims.length === 0) {
        const found = findLine(ctx, agent, null, true);
        return found === null ? nothing(agent) : claimLine(ctx, agent, found.line, found.role);
      }
      // On several lines: the first, longest-held, with something to do next; else the one taken last.
      const withWork = claims.find(
        (claim) => result(ctx, requireLine(ctx, claim.line), claim.role, agent).next !== null,
      );
      const current = withWork ?? claims[claims.length - 1];
      if (current === undefined) return nothing(agent);
      return takeOwnLine(ctx, agent, requireLine(ctx, current.line), current.role);
    }
    const line = requireLine(ctx, input.ref);
    const current = claimOn(ctx, agent.name, line.ref);
    if (current !== null) return takeOwnLine(ctx, agent, line, current.role);
    return claimLine(ctx, agent, line, roleOn(ctx, line));
  }),

  bind(contracts.lineRelease, (ctx, input) => {
    const agent = requireSelf(ctx);
    const line =
      input.ref === undefined ? onlyLineOf(ctx, agent.name, "to leave") : requireLine(ctx, input.ref).ref;
    return { line: line === null ? null : (endClaim(ctx, agent.name, line, "release")?.line ?? null) };
  }),
];
