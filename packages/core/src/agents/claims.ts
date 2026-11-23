import { z } from "zod";
import { implementedRefs } from "../refs.ts";
import type { Line, LineClaim, LineCrew, Notice } from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { applyPatch, emit } from "../store/common.ts";
import { HELD_CURRENT_MS } from "./held.ts";
import { addNotice, briefOf, claimOn, claimsOf, claimsOn, getAgent } from "../store/agents.ts";
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
export const CHECK_IN_MS = 5 * MINUTE_MS;
/** Owner search step 1: the last owner alone, this long. */
const FIRST_OFFER_MS = 10 * MINUTE_MS;
/** Owner search step 2: idle agents with the repo, this long, before the runner (step 3) would start a session. */
const OFFER_STEP_MS = 30_000;
/** Scoping goes stale: an up-next line needs scoping again after eight weeks. */
const SCOPING_LASTS_MS = 8 * 7 * 24 * 60 * MINUTE_MS;

/**
 * Why a claim ended. Only an owner that wound down or whose process exited is offered its line first again. "switch" is
 * kept for lines whose last owner left that way, from when taking a line ended the one before.
 */
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

/** Ends every claim an agent holds, as Stop, a session gone or exited does: the lines it left, longest-held first. */
export function endClaims(ctx: Ctx, agent: string, why: ClaimEnd): LineClaim[] {
  return claimsOf(ctx, agent).flatMap((claim) => {
    const ended = endClaim(ctx, agent, claim.line, why);
    return ended === null ? [] : [ended];
  });
}

/**
 * Ends an agent's claim on one line. An owner leaving a working line hands it to its longest-standing helper with no
 * search, or else the search for an owner starts; a scoper releasing a line with a done when and a plan leaves it scoped.
 */
export function endClaim(ctx: Ctx, agent: string, lineRef: string, why: ClaimEnd): LineClaim | null {
  const claim = claimOn(ctx, agent, lineRef);
  if (claim === null) return null;
  ctx.sql.run("DELETE FROM line_claims WHERE agent = ? AND line = ?", [agent, lineRef]);
  const line = requireLine(ctx, claim.line);
  freeIssues(ctx, agent, line);
  if (claim.role === "owner") {
    ctx.sql.run("UPDATE lines SET lastOwner = ?, lastOwnerEnded = ? WHERE ref = ?", [agent, why, line.ref]);
    if (line.state === "working" && line.ownedBy === null && !windingDown(line, ctx.now)) {
      const helper = claimsOn(ctx, line.ref).find((other) => other.role === "helper");
      if (helper === undefined) {
        startSearch(ctx, line, null);
      } else {
        ctx.sql.run("UPDATE line_claims SET role = 'owner' WHERE agent = ? AND line = ?", [
          helper.agent,
          line.ref,
        ]);
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

/**
 * Whether a line holds its agents' questions and tasks: when no agent works on it, because it is not being worked on or
 * because the developer owns it. An answer or a Done there would wait in an inbox no agent reads, so they wait, out of
 * the developer's queue and to do, for an agent to work on the line again.
 */
export function holdsWork(line: Line): boolean {
  return line.state !== "working" || line.ownedBy !== null;
}

/**
 * Questions and tasks on a line no agent works on are held; they wait for its next start. The developer's own tasks
 * (with no outcome to send anyone) are never held: they are theirs to do whoever works on the line.
 */
function holdWork(ctx: Ctx, line: string): void {
  ctx.sql.run("UPDATE decisions SET heldAt = ? WHERE line = ? AND status = 'open' AND heldAt IS NULL", [
    ctx.now,
    line,
  ]);
  ctx.sql.run(
    `UPDATE issues SET heldAt = ? WHERE line = ? AND assignee = 'dev' AND outcome IS NOT NULL AND outcome <> ''
       AND status NOT IN ('done', 'cancelled') AND heldAt IS NULL`,
    [ctx.now, line],
  );
}

/**
 * Questions and tasks that arrived on a line from elsewhere (a fold) take the line's own state: held if nobody works on
 * it, or, on a line being worked on, reaching the developer at once when current and waiting to be re-confirmed when not.
 */
export function settleHeldWork(ctx: Ctx, line: Line): void {
  if (holdsWork(line)) holdWork(ctx, line.ref);
  else releaseCurrentWork(ctx, line.ref);
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

/** SQL for an issue `i` that waits on nothing unfinished: no open issue and no open question blocks it. */
export const NOT_BLOCKED = `NOT EXISTS (
  SELECT 1 FROM links l
    LEFT JOIN issues b ON b.ref = l.fromRef
    LEFT JOIN decisions d ON d.ref = l.fromRef
  WHERE l.toRef = i.ref AND l.rel = 'blocks'
    AND ((b.ref IS NOT NULL AND b.status NOT IN ('done', 'cancelled')) OR (d.ref IS NOT NULL AND d.status = 'open')))`;

/**
 * All of a working line's open work waits on the developer: questions or tasks that reach them, and nothing an agent can
 * pick up. A held question or task waits on an agent to re-confirm it, so it does not count.
 */
export function waitingOnYou(ctx: Ctx, line: string): boolean {
  const count = (sql: string) => one(ctx, z.object({ n: z.number() }), sql, [line])?.n ?? 0;
  const forYou =
    count("SELECT COUNT(*) AS n FROM decisions WHERE line = ? AND status = 'open' AND heldAt IS NULL") +
    count(
      `SELECT COUNT(*) AS n FROM issues WHERE line = ? AND assignee = 'dev' AND outcome IS NOT NULL
         AND status NOT IN ('done', 'cancelled') AND heldAt IS NULL`,
    );
  if (forYou === 0) return false;
  const workable = count(
    `SELECT COUNT(*) AS n FROM issues i WHERE i.line = ? AND (i.assignee IS NULL OR i.assignee <> 'dev')
       AND i.status NOT IN ('done', 'cancelled', 'blocked')
       AND ${NOT_BLOCKED}`,
  );
  return workable === 0;
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
  // Idle, or only scoping: one at work owning or helping elsewhere is not offered it first.
  return claimsOf(ctx, agent.name).every((claim) => claim.role === "scoper") ? agent.name : null;
}

/**
 * A line becoming working: its scoper owns it, a wind-down in progress is called off, and an empty line is searched for.
 * Its held work is released only if agents work on it: one the developer owns, tabled and started again, keeps it held
 * until it is handed back (fifth audit, B2).
 */
function beginWorking(ctx: Ctx, line: Line): void {
  ctx.sql.run("UPDATE lines SET windDownUntil = NULL, windDownWrites = 0 WHERE ref = ?", [line.ref]);
  settleHeldWork(ctx, line);
  // A line that names no repo has nowhere for an agent to work: it is the developer's own.
  if (line.repos.length === 0 && line.ownedBy === null) {
    ctx.sql.run("UPDATE lines SET ownedBy = 'dev' WHERE ref = ?", [line.ref]);
    return;
  }
  const crew = claimsOn(ctx, line.ref);
  const scoper = crew.find((claim) => claim.role === "scoper");
  if (scoper !== undefined && !crew.some((claim) => claim.role === "owner")) {
    ctx.sql.run("UPDATE line_claims SET role = 'owner' WHERE agent = ? AND line = ?", [
      scoper.agent,
      line.ref,
    ]);
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
    ? "Stop scoping it: your claim on it ends now."
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
  dropped: "dropped it",
};

/**
 * What a line's move means for the agents on it and for whoever proposed it. Called by every move; `placed` says what
 * became of a proposal when its new state alone does not (Not a line and Fold into both leave it dropped).
 */
export function afterMove(ctx: Ctx, before: Line, after: Line, placed?: string): void {
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
      `Your proposal ${after.ref} ${after.title}: the developer ${placed ?? PLACED[after.state]}.`,
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
      for (const claim of claimsOn(ctx, line.ref)) endClaim(ctx, claim.agent, line.ref, "wind_down");
    }
    if (line.state === "done" || line.state === "dropped") closeWithLine(ctx, line);
    else if (line.state !== "working" || line.ownedBy !== null) listHeldPrs(ctx, line);
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
  // A session that has not taken its line five minutes after its process started never will: it stops holding the
  // line's turn. Its worktree and setup, before that, can take as long as they take.
  ctx.sql.run(
    `UPDATE runner_starts SET state = 'never_took', endedAt = ?
     WHERE state = 'starting' AND spawnedAt IS NOT NULL AND spawnedAt <= ?
       AND NOT EXISTS (SELECT 1 FROM line_claims c WHERE c.agent = runner_starts.name AND c.line = runner_starts.line)`,
    [ctx.now, new Date(Date.parse(ctx.now) - CHECK_IN_MS).toISOString()],
  );
  ctx.sql.run(
    "UPDATE lines SET scopedAt = NULL WHERE state = 'up_next' AND scopedAt IS NOT NULL AND scopedAt <= ?",
    [new Date(Date.parse(ctx.now) - SCOPING_LASTS_MS).toISOString()],
  );
}

const PrRefRow = z.object({ ref: z.string() });

/** Pull requests still open when a held line's wind-down ends stay, held with the line, and the log lists them once. */
function listHeldPrs(ctx: Ctx, line: Line): void {
  const open = rows(
    ctx,
    PrRefRow,
    `SELECT DISTINCT p.ref AS ref FROM prs p
       JOIN links l ON l.fromRef = p.ref AND l.rel = 'implements'
       JOIN issues i ON i.ref = l.toRef
     WHERE i.line = ? AND p.state IN ('open', 'draft') ORDER BY p.ref`,
    [line.ref],
  ).map((row) => row.ref);
  if (open.length === 0) return;
  emit(ctx, {
    type: "line.prs_held",
    kind: "line",
    ref: line.ref,
    project: line.repos[0] ?? null,
    line: line.ref,
    summary: `${line.ref} holds ${open.length === 1 ? "an open pull request" : `${open.length} open pull requests`}, kept as they are until it is worked on again: ${open.join(", ")}`,
    related: open,
    attrs: { status: line.state },
  });
}

const OpenPrRow = z.object({
  ref: z.string(),
  title: z.string(),
  headRef: z.string(),
  body: z.string(),
  headSha: z.string(),
  issue: z.string(),
});

/**
 * The pull requests the runner may close with a line that ended: those open now, as GitHub last reported them, whose
 * branch or closing keyword names one of the line's issues (D14). One opened or pushed to after this is held and shown,
 * never closed, and one only an agent reported is never closed, since closing on GitHub cannot be undone.
 */
function markPrsToClose(ctx: Ctx, line: Line): void {
  const open = rows(
    ctx,
    OpenPrRow,
    `SELECT p.ref AS ref, p.title AS title, p.headRef AS headRef, p.body AS body, p.headSha AS headSha, i.ref AS issue
     FROM prs p JOIN links k ON k.fromRef = p.ref AND k.rel = 'implements' JOIN issues i ON i.ref = k.toRef
     WHERE i.line = ? AND p.state IN ('open', 'draft') AND p.githubAt IS NOT NULL`,
    [line.ref],
  );
  for (const pr of open) {
    if (!implementedRefs(pr).includes(pr.issue)) continue;
    ctx.sql.run("INSERT OR IGNORE INTO line_closing_prs (line, pr, headSha, at) VALUES (?, ?, ?, ?)", [
      line.ref,
      pr.ref,
      pr.headSha,
      ctx.now,
    ]);
  }
}

export function closeWithLine(ctx: Ctx, line: Line): void {
  markPrsToClose(ctx, line);
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
  const claims = claimsOf(ctx, name);
  // An owner speaks for its line already; lines needing an owner are offered to idle agents and helpers.
  if (claims.some((claim) => claim.role === "owner")) return [];
  const repo = agent.repo;
  return allLines(ctx, "WHERE state = 'working'").flatMap((line): Notice[] => {
    const search = searchOf(ctx, line.ref);
    if (
      search === null ||
      line.ownedBy !== null ||
      claims.some((claim) => claim.line === line.ref) ||
      !line.repos.includes(repo)
    ) {
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
