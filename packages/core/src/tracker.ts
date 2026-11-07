import type { z } from "zod";
import type { BatchOp, BatchRequest, BatchResult, Contract, ErrorBody } from "./contracts.ts";
import { contracts } from "./contracts.ts";
import type { SqlDriver } from "./db/driver.ts";
import { migrate } from "./db/migrations.ts";
import { reconcileDrift } from "./drift/engine.ts";
import { OctoError } from "./errors.ts";
import type { BoundOp } from "./ops/bind.ts";
import { decisionOps } from "./ops/decisions.ts";
import { ideaOps } from "./ops/ideas.ts";
import { issueOps } from "./ops/issues.ts";
import { linkOps } from "./ops/links.ts";
import { miscOps, seedViews } from "./ops/misc.ts";
import { prOps } from "./ops/prs.ts";
import { projectOps } from "./ops/projects.ts";
import type { Channel, Drift, FeedEvent } from "./schemas.ts";
import { currentCursor } from "./store/common.ts";
import type { Ctx } from "./store/context.ts";
import { rows } from "./store/context.ts";
import { EventRow } from "./store/rows.ts";
import { expireAbandonedWatches } from "./watch/engine.ts";

export interface Caller {
  actor: string;
  channel: Channel;
}

export interface OpOutcome {
  data: unknown;
  driftOpened: Drift[];
  cursor: number;
}

/**
 * Notified after every write, which is how the dashboard stays current without a reload. An empty list means that only
 * state outside the feed changed, such as an agent's note or a new watch.
 */
export type ChangeListener = (events: readonly FeedEvent[]) => void;

/** Operations that touch nothing the drift rules look at. Watches poll constantly, so this matters. */
const NO_RECONCILE: ReadonlySet<string> = new Set([
  "watch.create",
  "watch.check",
  "watch.cancel",
  "view.save",
  "view.remove",
  "agent.note",
]);
/**
 * Every write notifies, unless it is listed here. It is this way around so that a new operation cannot silently fail to
 * reach the dashboard. Polling is the exception: a waiting agent checks constantly, each check would wake the others, and
 * nothing a person can see has usually changed. A poll sets `visibleChange` when something has.
 */
const POLLS: ReadonlySet<string> = new Set(["watch.check"]);

const AGENT_TOUCH_INTERVAL_MS = 30_000;

const ALL_OPS: readonly BoundOp[] = [
  ...projectOps,
  ...issueOps,
  ...decisionOps,
  ...prOps,
  ...ideaOps,
  ...linkOps,
  ...miscOps,
];

export function toErrorBody(error: unknown): ErrorBody {
  if (error instanceof OctoError) return { code: error.code, message: error.message, hint: error.hint };
  return { code: "internal", message: error instanceof Error ? error.message : String(error), hint: null };
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (Array.isArray(current)) {
      current = current[Number(key)];
    } else if (typeof current === "object" && current !== null) {
      current = Object.entries(current).find(([name]) => name === key)?.[1];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Replaces whole-string `$alias.field` references with values from earlier batch results. */
function substitute(value: unknown, aliases: ReadonlyMap<string, unknown>): unknown {
  if (typeof value === "string") {
    const match = /^\$([a-zA-Z_][a-zA-Z0-9_]*)((?:\.[a-zA-Z0-9_]+)*)$/.exec(value);
    const alias = match?.[1];
    if (alias === undefined || !aliases.has(alias)) return value;
    const path = (match?.[2] ?? "").split(".").filter((part) => part !== "");
    const resolved = readPath(aliases.get(alias), path);
    if (resolved === undefined)
      throw new OctoError("invalid_input", `Reference ${value} resolved to nothing`);
    return resolved;
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, aliases));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, aliases)]));
  }
  return value;
}

export class Tracker {
  private readonly ops = new Map<string, BoundOp>(ALL_OPS.map((op) => [op.name, op]));
  private readonly listeners = new Set<ChangeListener>();
  private readonly agentTouchedAt = new Map<string, number>();

  constructor(
    private readonly sql: SqlDriver,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {
    migrate(sql);
    sql.transaction(() => seedViews(this.ctx({ actor: "octotrack", channel: "cli" })));
  }

  private ctx(caller: Caller): Ctx {
    return {
      sql: this.sql,
      actor: caller.actor,
      channel: caller.channel,
      now: this.clock(),
      openedDrift: [],
      visibleChange: false,
    };
  }

  listOps(): readonly BoundOp[] {
    return ALL_OPS;
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  cursor(): number {
    return currentCursor(this.ctx({ actor: "octotrack", channel: "cli" }));
  }

  eventsSince(seq: number, limit = 500): FeedEvent[] {
    const ctx = this.ctx({ actor: "octotrack", channel: "cli" });
    return rows(ctx, EventRow, "SELECT * FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?", [seq, limit]);
  }

  private notify(events: readonly FeedEvent[]): void {
    for (const listener of this.listeners) listener(events);
  }

  /**
   * Runs before an operation's transaction, never inside it: if the operation failed and rolled back, the throttle below
   * would still believe the agent was recorded, and calls that need the row would fail until it expired.
   */
  private touchAgent(ctx: Ctx): void {
    if (ctx.channel === "dashboard") return;
    const nowMs = Date.parse(ctx.now);
    const previous = this.agentTouchedAt.get(ctx.actor);
    if (previous !== undefined && nowMs - previous < AGENT_TOUCH_INTERVAL_MS) return;
    this.agentTouchedAt.set(ctx.actor, nowMs);
    ctx.sql.run(
      `INSERT INTO agents (name, firstSeenAt, lastSeenAt) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET lastSeenAt = excluded.lastSeenAt`,
      [ctx.actor, ctx.now, ctx.now],
    );
    if (previous === undefined) this.notify([]);
  }

  private requireOp(name: string): BoundOp {
    const op = this.ops.get(name);
    if (op === undefined) {
      throw new OctoError("unknown_op", `Unknown operation "${name}"`, "Run `octo ops` to list operations.");
    }
    return op;
  }

  execute(name: string, input: unknown, caller: Caller): OpOutcome {
    const op = this.requireOp(name);
    const ctx = this.ctx(caller);
    if (!op.mutates) {
      this.touchAgent(ctx);
      return { data: op.run(ctx, input), driftOpened: [], cursor: currentCursor(ctx) };
    }
    this.touchAgent(ctx);
    const before = currentCursor(ctx);
    const data = this.sql.transaction(() => {
      const result = op.run(ctx, input);
      if (!NO_RECONCILE.has(name)) reconcileDrift(ctx, before);
      return result;
    });
    const events = this.eventsSince(before);
    if (!POLLS.has(name) || events.length > 0 || ctx.visibleChange) this.notify(events);
    return { data, driftOpened: ctx.openedDrift, cursor: currentCursor(ctx) };
  }

  /** The typed path for server-side callers such as the sweep loop. */
  call<I extends z.ZodType, O extends z.ZodType>(
    contract: Contract<I, O>,
    input: z.input<I>,
    caller: Caller,
  ): z.output<O> {
    return contract.output.parse(this.execute(contract.name, input, caller).data);
  }

  batch(request: BatchRequest, caller: Caller): BatchResult {
    if (request.atomic === false) return this.batchIndependent(request.ops, caller);
    return this.batchAtomic(request.ops, caller);
  }

  private batchIndependent(ops: readonly BatchOp[], caller: Caller): BatchResult {
    const aliases = new Map<string, unknown>();
    const driftOpened: Drift[] = [];
    const results = ops.map((item) => {
      try {
        const outcome = this.execute(item.op, substitute(item.input, aliases), caller);
        if (item.as !== undefined) aliases.set(item.as, outcome.data);
        driftOpened.push(...outcome.driftOpened);
        return { op: item.op, ok: true, data: outcome.data, error: null };
      } catch (error) {
        return { op: item.op, ok: false, data: null, error: toErrorBody(error) };
      }
    });
    return { ok: results.every((result) => result.ok), results, driftOpened, cursor: this.cursor() };
  }

  private batchAtomic(ops: readonly BatchOp[], caller: Caller): BatchResult {
    const ctx = this.ctx(caller);
    const before = currentCursor(ctx);
    const aliases = new Map<string, unknown>();
    const outputs: unknown[] = [];
    const state: { failure: { index: number; error: ErrorBody } | null } = { failure: null };
    const rollback = new Error("batch rollback");
    this.touchAgent(ctx);
    try {
      this.sql.transaction(() => {
        for (const [index, item] of ops.entries()) {
          try {
            const op = this.requireOp(item.op);
            const output = op.run(ctx, substitute(item.input, aliases));
            outputs.push(output);
            if (item.as !== undefined) aliases.set(item.as, output);
          } catch (error) {
            state.failure = { index, error: toErrorBody(error) };
            throw rollback;
          }
        }
        reconcileDrift(ctx, before);
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const failed = state.failure;
    if (failed !== null) {
      return {
        ok: false,
        results: ops.map((item, index) => ({
          op: item.op,
          ok: false,
          data: null,
          error:
            index === failed.index
              ? failed.error
              : {
                  code: "rolled_back",
                  message: "Not applied because another op in this batch failed",
                  hint: null,
                },
        })),
        driftOpened: [],
        cursor: this.cursor(),
      };
    }
    this.notify(this.eventsSince(before));
    return {
      ok: true,
      results: ops.map((item, index) => ({ op: item.op, ok: true, data: outputs[index], error: null })),
      driftOpened: ctx.openedDrift,
      cursor: currentCursor(ctx),
    };
  }

  /** Re-evaluates time-based rules and drops abandoned watches. Run periodically by the server. */
  sweep(): OpOutcome {
    const system: Caller = { actor: "octotrack", channel: "cli" };
    const ctx = this.ctx(system);
    this.sql.transaction(() => expireAbandonedWatches(ctx));
    // Last, because it notifies, and the dashboard should then see the watches already gone. This is also how an agent
    // that vanished without saying goodbye stops being shown as waiting: nothing else would ever tell the page.
    return this.execute(contracts.driftScan.name, {}, system);
  }
}
