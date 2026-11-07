import { OctoError, notFound } from "../errors.ts";
import { explicitRefsInQuery, matchQuery, parseQuery, refsInQuery, valuesInQuery } from "../query/index.ts";
import {
  type EntitySummary,
  type FeedEvent,
  type Watch,
  type WatchClauseResult,
  WatchResult,
  type WatchSpec,
} from "../schemas.ts";
import { currentCursor, nextNumber } from "../store/common.ts";
import { type Ctx, one, rows } from "../store/context.ts";
import { eventDoc, findEntities, matchEnv } from "../store/docs.ts";
import { findEntity, getProject } from "../store/entities.ts";
import { type GraphSnapshot, loadGraph } from "../store/graph.ts";
import { EventRow, WatchRow } from "../store/rows.ts";

/** A watching agent polls at least every 25 seconds, so silence for longer than this means it has gone. */
export const WAITING_WINDOW_MS = 90_000;
/** Ephemeral watches belong to one CLI process. If it stopped polling and never said goodbye, drop the watch. */
const EPHEMERAL_TTL_MS = 5 * 60_000;
const MAX_EVENTS_PER_CLAUSE = 200;
const NEVER_POLLED = "1970-01-01T00:00:00.000Z";

export function toWatch(row: WatchRow, now: string): Watch {
  const { result: _result, ...watch } = row;
  return {
    ...watch,
    waiting: row.status === "active" && Date.parse(now) - Date.parse(row.lastSeenAt) < WAITING_WINDOW_MS,
  };
}

/**
 * `--until-none` on something that does not exist matches nothing, so it would fire at once and look like success.
 * Anything a clause names explicitly therefore has to exist. Returns the canonical refs it mentions.
 */
export function assertValidSpec(ctx: Ctx, spec: WatchSpec): string[] {
  const refs = new Set<string>();
  for (const clause of spec.clauses) {
    const ast = parseQuery(clause.query);
    for (const ref of explicitRefsInQuery(ast)) {
      const entity = findEntity(ctx, ref);
      if (entity === null) throw notFound(ref);
      refs.add(entity.value.ref);
    }
    for (const ref of refsInQuery(ast)) {
      const entity = findEntity(ctx, ref);
      if (entity !== null) refs.add(entity.value.ref);
    }
    for (const project of valuesInQuery(ast, "project")) {
      if (project.includes("*") || project.includes("?") || project.toLowerCase() === "none") continue;
      if (getProject(ctx, project.toUpperCase()) === null) throw notFound(project);
    }
  }
  return [...refs];
}

export interface CreateWatchInput {
  spec: WatchSpec;
  name?: string;
  since?: number;
  follow?: boolean;
  ephemeral?: boolean;
}

export function createWatch(ctx: Ctx, input: CreateWatchInput): Watch {
  const refs = assertValidSpec(ctx, input.spec);
  if (input.follow === true && input.spec.clauses.some((clause) => clause.type === "state")) {
    // A state clause stays true once it is true, so following it would fire on every poll.
    throw new OctoError(
      "invalid_input",
      "--follow only works with --on clauses",
      "Use --on, or drop --follow.",
    );
  }
  if (input.name !== undefined) {
    const existing = one(
      ctx,
      WatchRow,
      "SELECT * FROM watches WHERE agent = ? AND name = ? AND status = 'active'",
      [ctx.actor, input.name],
    );
    if (existing !== null) {
      throw new OctoError(
        "conflict",
        `${ctx.actor} already has an active watch named ${input.name}`,
        `Use \`octo watch wait ${input.name}\`, or cancel it first.`,
      );
    }
  }
  const ref = `W-${nextNumber(ctx, "watch")}`;
  ctx.sql.run(
    `INSERT INTO watches (ref, name, agent, spec, cursor, follow, ephemeral, status, refs, createdAt, lastSeenAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [
      ref,
      input.name ?? null,
      ctx.actor,
      JSON.stringify(input.spec),
      input.since ?? currentCursor(ctx),
      input.follow === true ? 1 : 0,
      input.ephemeral === true ? 1 : 0,
      JSON.stringify(refs),
      ctx.now,
      // A one-shot watch is hung on from the moment it exists. A registered one is not waiting on anything until its
      // owner actually polls it, or the dashboard would claim that an agent is blocked when it is off doing other work.
      input.ephemeral === true ? ctx.now : NEVER_POLLED,
    ],
  );
  return requireWatch(ctx, ref);
}

export function requireWatch(ctx: Ctx, refOrName: string): Watch {
  const row = one(
    ctx,
    WatchRow,
    `SELECT * FROM watches WHERE ref = ? OR (agent = ? AND name = ?)
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, createdAt DESC LIMIT 1`,
    [refOrName.toUpperCase(), ctx.actor, refOrName],
  );
  if (row === null) throw notFound(refOrName);
  return toWatch(row, ctx.now);
}

function matchingEvents(ctx: Ctx, query: string, cursor: number, graph: GraphSnapshot): FeedEvent[] {
  const ast = parseQuery(query);
  const env = matchEnv(ctx, graph);
  const candidates = rows(ctx, EventRow, "SELECT * FROM events WHERE seq > ? ORDER BY seq ASC", [cursor]);
  return candidates.filter((event) => matchQuery(ast, eventDoc(event), env));
}

function evaluateClauses(ctx: Ctx, watch: Watch, graph: GraphSnapshot): WatchClauseResult[] {
  return watch.spec.clauses.map((clause, index) => {
    if (clause.type === "event") {
      const events = matchingEvents(ctx, clause.query, watch.cursor, graph);
      return {
        index,
        type: "event",
        query: clause.query,
        // Counted before trimming, or a count above the page size could never be reached.
        satisfied: events.length >= clause.count,
        events: events.slice(0, MAX_EVENTS_PER_CLAUSE),
        entities: [],
      };
    }
    const entities: EntitySummary[] = findEntities(ctx, clause.query, 200, graph);
    return {
      index,
      type: "state",
      query: clause.query,
      satisfied: clause.mode === "exists" ? entities.length > 0 : entities.length === 0,
      events: [],
      entities,
    };
  });
}

/**
 * A burst larger than one response must not lose its tail: when a clause returned a full page, resume right after the
 * last event it returned instead of jumping to the end of the log.
 */
function resumePoint(clauses: readonly WatchClauseResult[], cursorNow: number): number {
  const lastReturned = clauses
    .filter((clause) => clause.events.length === MAX_EVENTS_PER_CLAUSE)
    .map((clause) => clause.events[clause.events.length - 1]?.seq ?? cursorNow);
  return Math.min(cursorNow, ...lastReturned);
}

/** Evaluates a watch and records the outcome. A fired watch stays fired, unless it follows. */
export function checkWatch(ctx: Ctx, refOrName: string): WatchResult {
  const found = requireWatch(ctx, refOrName);
  const cursorNow = currentCursor(ctx);
  if (found.status === "fired") return storedResult(ctx, found);
  if (found.status === "cancelled") {
    throw new OctoError("conflict", `Watch ${found.ref} was cancelled`, "Start a new watch.");
  }
  // An expired watch being polled means its owner is alive after all, for instance after a long server outage.
  const watch = found.status === "expired" ? reviveWatch(ctx, found) : found;
  // Starting to be polled is what makes an agent count as waiting. Later polls change nothing a person can see.
  if (!found.waiting) ctx.visibleChange = true;
  const graph = loadGraph(ctx);
  const clauses = evaluateClauses(ctx, watch, graph);
  const fired =
    watch.spec.require === "all"
      ? clauses.every((clause) => clause.satisfied)
      : clauses.some((clause) => clause.satisfied);

  // A partly matched clause (`all` waiting on the others, or a count not reached yet) must keep its events, so the
  // cursor holds still. With no match at all, those events can never matter and the cursor can move.
  const partial = clauses.some((clause) => clause.events.length > 0);
  const nextCursor = fired || !partial ? resumePoint(clauses, cursorNow) : watch.cursor;
  const result: WatchResult = { watch: watch.ref, name: watch.name, fired, cursor: nextCursor, clauses };
  if (fired && !watch.follow) {
    ctx.visibleChange = true;
    ctx.sql.run(
      "UPDATE watches SET status = 'fired', firedAt = ?, lastSeenAt = ?, cursor = ?, result = ? WHERE ref = ?",
      [ctx.now, ctx.now, nextCursor, JSON.stringify(result), watch.ref],
    );
  } else {
    ctx.sql.run("UPDATE watches SET lastSeenAt = ?, cursor = ? WHERE ref = ?", [
      ctx.now,
      nextCursor,
      watch.ref,
    ]);
  }
  return result;
}

function storedResult(ctx: Ctx, watch: Watch): WatchResult {
  const row = one(ctx, WatchRow, "SELECT * FROM watches WHERE ref = ?", [watch.ref]);
  if (row?.result === null || row?.result === undefined) {
    return { watch: watch.ref, name: watch.name, fired: true, cursor: watch.cursor, clauses: [] };
  }
  const parsed: unknown = JSON.parse(row.result);
  return WatchResult.parse(parsed);
}

function reviveWatch(ctx: Ctx, watch: Watch): Watch {
  ctx.sql.run("UPDATE watches SET status = 'active' WHERE ref = ?", [watch.ref]);
  return { ...watch, status: "active" };
}

export function cancelWatch(ctx: Ctx, refOrName: string): string {
  const watch = requireWatch(ctx, refOrName);
  ctx.sql.run("UPDATE watches SET status = 'cancelled' WHERE ref = ? AND status = 'active'", [watch.ref]);
  return watch.ref;
}

export function expireAbandonedWatches(ctx: Ctx): void {
  const threshold = new Date(Date.parse(ctx.now) - EPHEMERAL_TTL_MS).toISOString();
  ctx.sql.run(
    "UPDATE watches SET status = 'expired' WHERE status = 'active' AND ephemeral = 1 AND lastSeenAt < ?",
    [threshold],
  );
}

export function listWatches(ctx: Ctx, all: boolean, agent: string | undefined): Watch[] {
  const statusClause = all ? "" : "status = 'active' AND ";
  const found =
    agent === undefined
      ? rows(
          ctx,
          WatchRow,
          `SELECT * FROM watches WHERE ${statusClause}1 = 1 ORDER BY createdAt DESC LIMIT 200`,
        )
      : rows(
          ctx,
          WatchRow,
          `SELECT * FROM watches WHERE ${statusClause}agent = ? ORDER BY createdAt DESC LIMIT 200`,
          [agent],
        );
  return found.map((row) => toWatch(row, ctx.now));
}
