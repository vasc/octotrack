import { z } from "zod";
import { RefusedWrite } from "../errors.ts";
import type { Line, LineClaim, LineCrew, Notice } from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { applyPatch, emit } from "../store/common.ts";
import { HELD_CURRENT_MS } from "./held.ts";
import { addNotice, briefOf, claimOf, claimsOn, getAgent } from "../store/agents.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines, requireLine } from "../store/entities.ts";
import { rankAtEnd } from "../store/ranks.ts";
import { IssueRow } from "../store/rows.ts";
import { agentState, isReachable } from "./state.ts";

const MINUTE_MS = 60_000;
/** How long the agents on a line that left working on have to wrap up. */
export const WIND_DOWN_MS = 15 * MINUTE_MS;
/** A session Octotrack started has this long to take its line. */
const CHECK_IN_MS = 5 * MINUTE_MS;
/** Owner search step 1: the last owner alone, this long. */
const FIRST_OFFER_MS = 10 * MINUTE_MS;
/** Owner search step 2: idle agents with the repo, this long, before the runner (step 3) would start a session. */
const OFFER_STEP_MS = 30_000;
/** Scoping goes stale: an up-next line needs scoping again after eight weeks. */
const SCOPING_LASTS_MS = 8 * 7 * 24 * 60 * MINUTE_MS;

/** Why a claim ended. Only an owner that wound down or whose process exited is offered its line first again. */
export const ClaimEnd = z.enum(["release", "released", "switch", "stop", "gone", "wind_down", "exit"]);
export type ClaimEnd = z.infer<typeof ClaimEnd>;
const COMES_BACK_FIRST: ReadonlySet<ClaimEnd> = new Set(["wind_down", "exit"]);

const SearchRow = z.object({
  line: z.string(),
  since: z.string(),
  firstOffer: z.string().nullable(),
  firstUntil: z.string().nullable(),
});
type Search = z.infer<typeof SearchRow>;
const LastOwnerRow = z.object({ lastOwner: z.string().nullable(), lastOwnerEnded: ClaimEnd.nullable() });
const WindDownRow = z.object({ windDownWrites: z.number() });

const later = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

export function windingDown(line: Line, now: string): boolean {
  return line.windDownUntil !== null && line.windDownUntil > now;
}

function emitAgent(ctx: Ctx, type: EventTypeName, agent: string, line: Line | null, summary: string): void {
  emit(ctx, {
    type,
    kind: "agent",
    ref: agent,
    project: line?.repos[0] ?? null,
    line: line?.ref ?? null,
    summary,
    attrs: line === null ? {} : { status: line.state },
  });
}

export function setClaim(ctx: Ctx, agent: string, line: Line, role: LineClaim["role"]): void {
  // A session Octotrack started checking in: its start is running now.
  ctx.sql.run(
    "UPDATE runner_starts SET state = 'running' WHERE name = ? AND line = ? AND state = 'starting'",
    [agent, line.ref],
  );
  ctx.sql.run("INSERT INTO line_claims (agent, line, role, since) VALUES (?, ?, ?, ?)", [
    agent,
    line.ref,
    role,
    ctx.now,
  ]);
  if (role === "owner") clearSearch(ctx, line.ref);
  emitAgent(ctx, "line.taken", agent, line, `${agent} took ${line.ref} as ${role}: ${line.title}`);
}

function hasPlanAndGoal(ctx: Ctx, line: Line): boolean {
  const steps = one(ctx, z.object({ n: z.number() }), "SELECT COUNT(*) AS n FROM plan_steps WHERE line = ?", [
    line.ref,
  ]);
  return line.doneWhen.trim() !== "" && (steps?.n ?? 0) > 0;
}

/**
 * Ends an agent's claim. An owner leaving a working line hands it to its longest-standing helper with no search, or else
 * the search for an owner starts; a scoper releasing a line with a done when and a plan leaves it scoped.
 */
export function endClaim(ctx: Ctx, agent: string, why: ClaimEnd): LineClaim | null {
  const claim = claimOf(ctx, agent);
  if (claim === null) return null;
  ctx.sql.run("DELETE FROM line_claims WHERE agent = ?", [agent]);
  const line = requireLine(ctx, claim.line);
  freeIssues(ctx, agent, line);
  if (claim.role === "owner") {
    ctx.sql.run("UPDATE lines SET lastOwner = ?, lastOwnerEnded = ? WHERE ref = ?", [agent, why, line.ref]);
    if (line.state === "working" && line.ownedBy === null && !windingDown(line, ctx.now)) {
      const helper = claimsOn(ctx, line.ref).find((other) => other.role === "helper");
      if (helper === undefined) {
        startSearch(ctx, line, null);
      } else {
        ctx.sql.run("UPDATE line_claims SET role = 'owner' WHERE agent = ?", [helper.agent]);
        addNotice(
          ctx,
          helper.agent,
          "promoted",
          line.ref,
          `${agent} left ${line.ref}, so you own it now: you speak for the line, write its summary and propose done.`,
          false,
        );
      }
    }
  }
  if (claim.role === "scoper" && why === "release" && hasPlanAndGoal(ctx, line)) {
    ctx.sql.run("UPDATE lines SET scopedAt = ? WHERE ref = ?", [ctx.now, line.ref]);
  }
  emitAgent(
    ctx,
    "line.released",
    agent,
    line,
    `${agent} left ${line.ref} (${claim.role}, ${why.replace("_", " ")})`,
  );
  return claim;
}

/**
 * An agent leaving a line leaves its open issues for whoever comes next, noting who held them and since when, so the
 * next holder can be told and find their branch.
 */
function freeIssues(ctx: Ctx, agent: string, line: Line): void {
  const held = rows(
    ctx,
    IssueRow,
    "SELECT * FROM issues WHERE line = ? AND assignee = ? AND status NOT IN ('done', 'cancelled')",
    [line.ref, agent],
  );
  for (const issue of held) {
    const changes = applyPatch(ctx, "issues", issue.ref, issue, {
      assignee: null,
      status: issue.status === "in_progress" ? "todo" : undefined,
      lastAssignee: agent,
      lastAssignedAt: issue.updatedAt,
    });
    emit(ctx, {
      type: "issue.released",
      kind: "issue",
      ref: issue.ref,
      project: issue.project,
      line: line.ref,
      summary: `${issue.ref} is free again: ${agent} left ${line.ref}`,
      attrs: { status: issue.status === "in_progress" ? "todo" : issue.status },
      changes,
    });
  }
}

/** Questions and tasks on a line nobody works on are held; they wait for its next start. */
function holdWork(ctx: Ctx, line: string): void {
  ctx.sql.run("UPDATE decisions SET heldAt = ? WHERE line = ? AND status = 'open' AND heldAt IS NULL", [
    ctx.now,
    line,
  ]);
  ctx.sql.run(
    `UPDATE issues SET heldAt = ? WHERE line = ? AND assignee = 'dev' AND outcome IS NOT NULL
       AND status NOT IN ('done', 'cancelled') AND heldAt IS NULL`,
    [ctx.now, line],
  );
}

/** When a line starts, held work that is still current reaches the developer; stale work waits to be re-confirmed. */
function releaseCurrentWork(ctx: Ctx, line: string): void {
  const since = new Date(Date.parse(ctx.now) - HELD_CURRENT_MS).toISOString();
  ctx.sql.run(
    "UPDATE decisions SET heldAt = NULL WHERE line = ? AND heldAt IS NOT NULL AND COALESCE(confirmedAt, createdAt) >= ?",
    [line, since],
  );
  ctx.sql.run(
    "UPDATE issues SET heldAt = NULL WHERE line = ? AND heldAt IS NOT NULL AND COALESCE(confirmedAt, createdAt) >= ?",
    [line, since],
  );
}

/** All of a working line's open work waits on the developer: questions or tasks, and nothing an agent can pick up. */
export function waitingOnYou(ctx: Ctx, line: string): boolean {
  const count = (sql: string) => one(ctx, z.object({ n: z.number() }), sql, [line])?.n ?? 0;
  const forYou =
    count("SELECT COUNT(*) AS n FROM decisions WHERE line = ? AND status = 'open'") +
    count(
      "SELECT COUNT(*) AS n FROM issues WHERE line = ? AND assignee = 'dev' AND outcome IS NOT NULL AND status NOT IN ('done', 'cancelled')",
    );
  if (forYou === 0) return false;
  const workable = count(
    `SELECT COUNT(*) AS n FROM issues i WHERE i.line = ? AND (i.assignee IS NULL OR i.assignee <> 'dev')
       AND i.status NOT IN ('done', 'cancelled', 'blocked')
       AND NOT EXISTS (
         SELECT 1 FROM links l
           LEFT JOIN issues b ON b.ref = l.fromRef
           LEFT JOIN decisions d ON d.ref = l.fromRef
         WHERE l.toRef = i.ref AND l.rel = 'blocks'
           AND ((b.ref IS NOT NULL AND b.status NOT IN ('done', 'cancelled')) OR (d.ref IS NOT NULL AND d.status = 'open')))`,
  );
  return workable === 0;
}

/** Something reached a line with no owner, so its search starts over, from offering it in replies. */
export function restartSearch(ctx: Ctx, line: string): void {
  ctx.sql.run("UPDATE owner_searches SET since = ?, firstOffer = NULL, firstUntil = NULL WHERE line = ?", [
    ctx.now,
    line,
  ]);
}

/** A last owner that cannot be woken is not waited on: the search moves past offering it the line. */
export function endFirstOffer(ctx: Ctx, agent: string): void {
  ctx.sql.run("UPDATE owner_searches SET firstUntil = ? WHERE firstOffer = ? AND firstUntil > ?", [
    ctx.now,
    agent,
    ctx.now,
  ]);
}

function clearSearch(ctx: Ctx, line: string): void {
  ctx.sql.run("DELETE FROM owner_searches WHERE line = ?", [line]);
}

function startSearch(ctx: Ctx, line: Line, firstOffer: string | null): void {
  ctx.sql.run(
    "INSERT OR REPLACE INTO owner_searches (line, since, firstOffer, firstUntil) VALUES (?, ?, ?, ?)",
    [line.ref, ctx.now, firstOffer, firstOffer === null ? null : later(ctx.now, FIRST_OFFER_MS)],
  );
  if (firstOffer !== null) {
    addNotice(
      ctx,
      firstOffer,
      "owner_offer",
      line.ref,
      `${line.ref} ${line.title} is being worked on again and you owned it last: octo line take ${line.ref}`,
      true,
    );
  }
}

/** The step a search is at, from when it started and whether the last owner was offered the line first. */
export function searchStep(search: Search, now: string): 1 | 2 | 3 {
  if (search.firstUntil !== null && now < search.firstUntil) return 1;
  return now < later(search.firstUntil ?? search.since, OFFER_STEP_MS) ? 2 : 3;
}

export function searchOf(ctx: Ctx, line: string): Search | null {
  return one(ctx, SearchRow, "SELECT * FROM owner_searches WHERE line = ?", [line]);
}

/** The last owner comes back first only if it wound down or its process exited, can be reached, and is idle now. */
function firstOfferFor(ctx: Ctx, line: Line): string | null {
  const last = one(ctx, LastOwnerRow, "SELECT lastOwner, lastOwnerEnded FROM lines WHERE ref = ?", [
    line.ref,
  ]);
  if (last === null || last.lastOwner === null || last.lastOwnerEnded === null) return null;
  if (!COMES_BACK_FIRST.has(last.lastOwnerEnded)) return null;
  const agent = getAgent(ctx, last.lastOwner);
  if (agent === null || !isReachable(agentState(agent, ctx.now))) return null;
  const claim = claimOf(ctx, agent.name);
  return claim === null || claim.role === "scoper" ? agent.name : null;
}

/** A line becoming working: its scoper owns it, a wind-down in progress is called off, and an empty line is searched for. */
function beginWorking(ctx: Ctx, line: Line): void {
  ctx.sql.run("UPDATE lines SET windDownUntil = NULL, windDownWrites = 0 WHERE ref = ?", [line.ref]);
  releaseCurrentWork(ctx, line.ref);
  // A line that names no repo has nowhere for an agent to work: it is the developer's own.
  if (line.repos.length === 0 && line.ownedBy === null) {
    ctx.sql.run("UPDATE lines SET ownedBy = 'dev' WHERE ref = ?", [line.ref]);
    return;
  }
  const crew = claimsOn(ctx, line.ref);
  const scoper = crew.find((claim) => claim.role === "scoper");
  if (scoper !== undefined && !crew.some((claim) => claim.role === "owner")) {
    ctx.sql.run("UPDATE line_claims SET role = 'owner' WHERE agent = ?", [scoper.agent]);
    addNotice(
      ctx,
      scoper.agent,
      "promoted",
      line.ref,
      `${line.ref} started, and you scoped it, so you own it now.`,
      true,
    );
  }
  if (line.ownedBy !== null) return;
  if (!claimsOn(ctx, line.ref).some((claim) => claim.role === "owner")) {
    startSearch(ctx, line, firstOfferFor(ctx, line));
  }
}

export function windDown(ctx: Ctx, line: Line, writes: boolean): void {
  ctx.sql.run("UPDATE lines SET windDownUntil = ?, windDownWrites = ? WHERE ref = ?", [
    later(ctx.now, WIND_DOWN_MS),
    writes ? 1 : 0,
    line.ref,
  ]);
  clearSearch(ctx, line.ref);
  holdWork(ctx, line.ref);
  const ending = line.state === "done" || line.state === "dropped";
  const now = line.ownedBy !== null ? "the developer's own now" : `now ${line.state.replace("_", " ")}`;
  const todo = !writes
    ? "Stop scoping it; your writes there are refused from now."
    : ending
      ? "Write a hand-off note, report on answers you took, then close or fold every open issue and pull request, and leave a closing note."
      : "Write a hand-off note, report on answers you took, and leave a branch note.";
  for (const claim of claimsOn(ctx, line.ref)) {
    addNotice(
      ctx,
      claim.agent,
      "wind_down",
      line.ref,
      `${line.ref} ${line.title} is ${now}. You have 15 minutes. ${todo} Then your claim ends.`,
      true,
    );
  }
}

const PLACED: Readonly<Record<Line["state"], string>> = {
  proposed: "left proposed",
  working: "started it",
  up_next: "put it up next",
  tabled: "tabled it",
  done: "marked it done",
  dropped: "said it is not a line",
};

/** What a line's move means for the agents on it and for whoever proposed it. Called by every move. */
export function afterMove(ctx: Ctx, before: Line, after: Line): void {
  if (before.state === after.state) return;
  if (after.state === "working") beginWorking(ctx, after);
  else if (before.state === "working") windDown(ctx, after, true);
  else if (claimsOn(ctx, after.ref).length > 0) windDown(ctx, after, false);
  else if (after.state === "done" || after.state === "dropped") {
    // Nobody is on it to wrap up, so what it leaves open closes with it now.
    closeWithLine(ctx, after);
  } else holdWork(ctx, after.ref);
  if (before.state === "proposed" && before.proposedBy !== null && before.proposedBy !== ctx.actor) {
    addNotice(
      ctx,
      before.proposedBy,
      "proposal_placed",
      after.ref,
      `Your proposal ${after.ref} ${after.title}: the developer ${PLACED[after.state]}.`,
      true,
    );
  }
}

/** A line added straight into working on needs an owner at once. */
export function afterAdd(ctx: Ctx, line: Line): void {
  if (line.state === "working") beginWorking(ctx, line);
}

/**
 * Deadlines, settled whenever anything is called and by the sweep, so that nothing waits for a timer: wind-downs that ran
 * out end their claims (and close what a done or dropped line left open), tabled lines whose date came come back to be
 * looked at, and scoping older than eight weeks lapses.
 */
export function settle(ctx: Ctx): void {
  for (const line of allLines(ctx, "WHERE windDownUntil IS NOT NULL AND windDownUntil <= ?", [ctx.now])) {
    if (line.state !== "working" || line.ownedBy !== null) {
      for (const claim of claimsOn(ctx, line.ref)) endClaim(ctx, claim.agent, "wind_down");
    }
    if (line.state === "done" || line.state === "dropped") closeWithLine(ctx, line);
    ctx.sql.run("UPDATE lines SET windDownUntil = NULL, windDownWrites = 0 WHERE ref = ?", [line.ref]);
  }
  const today = ctx.now.slice(0, 10);
  for (const line of allLines(
    ctx,
    "WHERE state = 'tabled' AND lookAgainAt IS NOT NULL AND substr(lookAgainAt, 1, 10) <= ?",
    [today],
  )) {
    const changes = applyPatch(ctx, "lines", line.ref, line, {
      state: "proposed",
      rank: rankAtEnd(ctx, "proposed"),
    });
    emit(ctx, {
      type: "line.look_again",
      kind: "line",
      ref: line.ref,
      project: line.repos[0] ?? null,
      line: line.ref,
      summary: `${line.ref} is back to look at again, as you asked: ${line.title}`,
      attrs: { status: "proposed" },
      changes,
    });
  }
  // A session that has not taken its line five minutes after it started never will: it stops holding the line's turn.
  ctx.sql.run(
    `UPDATE runner_starts SET state = 'never_took', endedAt = ?
     WHERE state = 'starting' AND startedAt <= ?
       AND NOT EXISTS (SELECT 1 FROM line_claims c WHERE c.agent = runner_starts.name AND c.line = runner_starts.line)`,
    [ctx.now, new Date(Date.parse(ctx.now) - CHECK_IN_MS).toISOString()],
  );
  ctx.sql.run(
    "UPDATE lines SET scopedAt = NULL WHERE state = 'up_next' AND scopedAt IS NOT NULL AND scopedAt <= ?",
    [new Date(Date.parse(ctx.now) - SCOPING_LASTS_MS).toISOString()],
  );
}

export function closeWithLine(ctx: Ctx, line: Line): void {
  const open = rows(
    ctx,
    IssueRow,
    "SELECT * FROM issues WHERE line = ? AND status NOT IN ('done', 'cancelled')",
    [line.ref],
  );
  for (const issue of open) {
    const changes = applyPatch(ctx, "issues", issue.ref, issue, { status: "cancelled", closedAt: ctx.now });
    emit(ctx, {
      type: "issue.status_changed",
      kind: "issue",
      ref: issue.ref,
      project: issue.project,
      line: line.ref,
      summary: `${issue.ref} closed with ${line.ref}, which is ${line.state}: ${issue.title}`,
      attrs: { status: "cancelled" },
      changes,
    });
  }
}

/** Lines that need an owner, offered in the replies of agents that could take them: idle ones, and helpers elsewhere. */
export function offersFor(ctx: Ctx, name: string): Notice[] {
  const agent = getAgent(ctx, name);
  if (agent === null || agent.repo === null) return [];
  const state = agentState(agent, ctx.now);
  if (state === "stopped" || state === "gone") return [];
  const claim = claimOf(ctx, name);
  if (claim !== null && claim.role === "owner") return [];
  const repo = agent.repo;
  return allLines(ctx, "WHERE state = 'working'").flatMap((line): Notice[] => {
    const search = searchOf(ctx, line.ref);
    if (search === null || line.ownedBy !== null || claim?.line === line.ref || !line.repos.includes(repo)) {
      return [];
    }
    if (searchStep(search, ctx.now) === 1) return [];
    return [
      {
        id: null,
        agent: name,
        kind: "needs_owner",
        line: line.ref,
        body: `${line.ref} ${line.title} needs an owner: octo line take ${line.ref}`,
        wakes: false,
        createdAt: ctx.now,
      },
    ];
  });
}

export function crewOf(ctx: Ctx, line: Line): LineCrew {
  const claims = claimsOn(ctx, line.ref);
  const owner = claims.find((claim) => claim.role === "owner");
  const scoper = claims.find((claim) => claim.role === "scoper");
  const search = line.state === "working" && line.ownedBy === null ? searchOf(ctx, line.ref) : null;
  return {
    owner: owner === undefined ? null : briefOf(ctx, owner.agent),
    helpers: claims.filter((claim) => claim.role === "helper").map((claim) => briefOf(ctx, claim.agent)),
    scoper: scoper === undefined ? null : briefOf(ctx, scoper.agent),
    search: search === null ? null : { step: searchStep(search, ctx.now), since: search.since },
  };
}

/** What kind of write: scoping (done when, plan, issues and notes) or work (claiming, progress, pull requests). */
export type LineWrite = "scope" | "work";

/**
 * What agents may write depends on the line's state (docs/DESIGN.md). The developer and Octotrack itself are never
 * held to it. Refusals that the state forbids count toward the automatic stop; the others are ordinary answers.
 */
export function guardLineWrite(ctx: Ctx, lineRef: string | null, kind: LineWrite): void {
  if (lineRef === null || ctx.developer || ctx.system) return;
  const line = requireLine(ctx, lineRef);
  const claim = claimOf(ctx, ctx.actor);
  const onLine = claim !== null && claim.line === line.ref;
  if (windingDown(line, ctx.now) && onLine) {
    const writes = one(ctx, WindDownRow, "SELECT windDownWrites FROM lines WHERE ref = ?", [line.ref]);
    if ((writes?.windDownWrites ?? 0) !== 0) return;
    throw new RefusedWrite(
      `${line.ref} is winding down and no longer takes your writes`,
      null,
      line.ref,
      false,
    );
  }
  if (line.ownedBy !== null) {
    throw new RefusedWrite(
      `${line.ref} is the developer's own: no agent writes to it until they hand it back`,
      null,
      line.ref,
      false,
    );
  }
  const state = line.state.replace("_", " ");
  switch (line.state) {
    case "working":
      return;
    case "proposed":
      if (kind === "scope" && line.proposedBy === ctx.actor) return;
      throw new RefusedWrite(
        `${line.ref} is a proposal: only the agent that proposed it may scope it, and nobody works on it yet`,
        "Wait for the developer to place it.",
        line.ref,
        false,
      );
    case "up_next":
      if (kind === "scope") {
        if (onLine && claim?.role === "scoper") return;
        throw new RefusedWrite(
          `${line.ref} is up next: only its scoper may scope it`,
          `Take it to scope: octo line take ${line.ref}`,
          line.ref,
          false,
        );
      }
      throw new RefusedWrite(
        `${line.ref} is up next: nobody claims, progresses or reports work on it until it starts`,
        "Scope it instead: its done when, plan, questions and tasks.",
        line.ref,
        true,
      );
    default:
      throw new RefusedWrite(
        `${line.ref} is ${state}: nothing is written to it`,
        "Run octo line take for a line that is being worked on.",
        line.ref,
        true,
      );
  }
}
