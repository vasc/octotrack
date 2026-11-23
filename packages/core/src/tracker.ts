import { z } from "zod";
import type { BatchOp, BatchRequest, BatchResult, Contract, ErrorBody } from "./contracts.ts";
import { contracts } from "./contracts.ts";
import type { SqlDriver } from "./db/driver.ts";
import { migrate } from "./db/migrations.ts";
import { reconcileDrift } from "./drift/engine.ts";
import { offersFor, settle } from "./agents/claims.ts";
import { refuseIfStopped, resolveAgent } from "./agents/identity.ts";
import { OctoError } from "./errors.ts";
import type { BoundOp } from "./ops/bind.ts";
import { decisionOps } from "./ops/decisions.ts";
import { ideaOps } from "./ops/ideas.ts";
import { issueOps } from "./ops/issues.ts";
import { applyChoice, choiceOps, dueChoices } from "./ops/choices.ts";
import { claimOps } from "./ops/claims.ts";
import { pushOps } from "./ops/push.ts";
import { makeRoom, runnerOps } from "./ops/runner.ts";
import { inboxOps } from "./ops/inbox.ts";
import { taskOps } from "./ops/tasks.ts";
import { lineOps } from "./ops/lines.ts";
import { planOps } from "./ops/plan.ts";
import { linkOps } from "./ops/links.ts";
import { miscOps, seedViews } from "./ops/misc.ts";
import { prOps } from "./ops/prs.ts";
import { projectOps } from "./ops/projects.ts";
import type { Channel, Drift, FeedEvent, Notice } from "./schemas.ts";
import { takeNotices } from "./store/agents.ts";
import { takeInbox } from "./store/inbox.ts";
import { currentCursor } from "./store/common.ts";
import type { Ctx } from "./store/context.ts";
import { rows } from "./store/context.ts";
import { EventRow } from "./store/rows.ts";
import { expireAbandonedWatches } from "./watch/engine.ts";

export interface Caller {
  actor: string;
  channel: Channel;
  /** The developer: the dashboard always is; the CLI only with --me. */
  developer?: boolean;
  /** The developer's own words an agent quotes to make one of the developer's operations for them. */
  said?: string;
  /** The folder the agent works in, sent by the CLI. One name is one session in one checkout. */
  checkout?: string;
  /** No name was given: the call is the one agent using its checkout, if there is exactly one. */
  anonymous?: boolean;
  /** Octotrack itself or GitHub sync, to which no agent rule applies. */
  system?: boolean;
}

export interface TrackerOptions {
  /** The GitHub repo (owner/name) a checkout's remote points at, read outside core because it needs git. */
  remoteOf?: (checkout: string) => string | null;
}

export interface OpOutcome {
  data: unknown;
  driftOpened: Drift[];
  cursor: number;
  /** What the calling agent must hear: its undelivered notices, then lines it could take that need an owner. */
  notices: Notice[];
}

/**
 * Notified after every write, which is how the dashboard stays current without a reload. An empty list means that only
 * state outside the feed changed, such as an agent's note or a new watch.
 */
export type ChangeListener = (events: readonly FeedEvent[]) => void;
/** Told the key of a draft just saved, so the developer's other devices can fetch that one draft and nothing else. */
export type DraftListener = (key: string) => void;

const DraftSaved = z.object({ key: z.string() });

/** Operations that touch nothing the drift rules look at. Watches poll constantly, so this matters. */
const NO_RECONCILE: ReadonlySet<string> = new Set([
  "watch.create",
  "watch.check",
  "watch.cancel",
  "view.save",
  "view.remove",
  "agent.note",
  "agent.register",
  "place.add",
  "place.remove",
  "held.confirm",
  "choice.make",
  "choice.undo",
  "draft.save",
  "runner.report",
  "runner.worktree",
  "runner.removed",
  "push.subscribe",
  "push.unsubscribe",
  "push.seen",
  "push.sent",
]);
/**
 * Every write notifies, unless it is listed here. It is this way around so that a new operation cannot silently fail to
 * reach the dashboard. Polling is the exception: a waiting agent checks constantly, each check would wake the others, and
 * nothing a person can see has usually changed. A poll sets `visibleChange` when something has.
 */
const DRAFT_SAVE = "draft.save";
const POLLS: ReadonlySet<string> = new Set(["watch.check", DRAFT_SAVE, "push.seen", "push.sent"]);

const AGENT_TOUCH_INTERVAL_MS = 30_000;

/**
 * Whether the third write in an hour that a line's state forbids stops the agent, or is only recorded as "would stop".
 * Off for now: risky automation runs watching first (docs/DESIGN.md, D13).
 */

const SYSTEM: Caller = { actor: "octotrack", channel: "cli", system: true };

const ALL_OPS: readonly BoundOp[] = [
  ...lineOps,
  ...planOps,
  ...claimOps,
  ...inboxOps,
  ...taskOps,
  ...choiceOps,
  ...runnerOps,
  ...pushOps,
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
  private readonly draftListeners = new Set<DraftListener>();
  /** When each agent was last recorded as seen, and from which checkout, so that a new checkout is recorded at once. */
  private readonly agentTouchedAt = new Map<string, { at: number; checkout: string | undefined }>();

  constructor(
    private readonly sql: SqlDriver,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly options: TrackerOptions = {},
  ) {
    migrate(sql);
    sql.transaction(() => seedViews(this.ctx(SYSTEM)));
  }

  private ctx(caller: Caller): Ctx {
    const said = caller.said === undefined || caller.said.trim() === "" ? null : caller.said.trim();
    const ctx: Ctx = {
      sql: this.sql,
      actor: caller.actor,
      channel: said === null ? caller.channel : "out_of_band",
      developer: caller.system !== true && (caller.developer === true || caller.channel === "dashboard"),
      said,
      system: caller.system === true,
      runOp: (name, input, as) => {
        const op = this.requireOp(name);
        // The server settling something runs as the server. Anything else is a choice that waited, and only the
        // developer makes those, so whoever made one is the developer.
        const inner = this.ctx(
          as.system === true
            ? { actor: as.actor, channel: as.channel, system: true }
            : {
                actor: as.actor,
                channel: as.channel,
                developer: true,
                ...(as.said === null ? {} : { said: as.said }),
              },
        );
        const result = op.run(inner, input);
        ctx.openedDrift.push(...inner.openedDrift);
        return result;
      },
      now: this.clock(),
      openedDrift: [],
      visibleChange: false,
    };
    return ctx;
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

  /** Draft saves are an exception to D9b: a notice of their own, which refreshes only that draft. */
  onDraft(listener: DraftListener): () => void {
    this.draftListeners.add(listener);
    return () => {
      this.draftListeners.delete(listener);
    };
  }

  cursor(): number {
    return currentCursor(this.ctx(SYSTEM));
  }

  eventsSince(seq: number, limit = 500): FeedEvent[] {
    const ctx = this.ctx(SYSTEM);
    return rows(ctx, EventRow, "SELECT * FROM events WHERE seq > ? ORDER BY seq ASC LIMIT ?", [seq, limit]);
  }

  private notify(events: readonly FeedEvent[]): void {
    for (const listener of this.listeners) listener(events);
  }

  /** The repo key a checkout serves, from its remote. Projects with no GitHub repo are named when registering. */
  private repoFor(ctx: Ctx, checkout: string | undefined): string | null {
    const slug = checkout === undefined ? null : (this.options.remoteOf?.(checkout) ?? null);
    if (slug === null) return null;
    const [project] = ctx.sql.all("SELECT ref FROM projects WHERE lower(repo) = lower(?)", [slug]);
    return typeof project === "object" &&
      project !== null &&
      "ref" in project &&
      typeof project.ref === "string"
      ? project.ref
      : null;
  }

  /**
   * Records an agent as seen, registering it on first sight with its checkout and the repo that checkout serves. Runs
   * before an operation's transaction, never inside it: if the operation failed and rolled back, the throttle below would
   * still believe the agent was recorded, and calls that need the row would fail until it expired.
   */
  private touchAgent(ctx: Ctx, caller: Caller): void {
    if (ctx.developer || ctx.system || caller.anonymous === true) return;
    const nowMs = Date.parse(ctx.now);
    const previous = this.agentTouchedAt.get(ctx.actor);
    if (
      previous !== undefined &&
      previous.checkout === caller.checkout &&
      nowMs - previous.at < AGENT_TOUCH_INTERVAL_MS
    ) {
      return;
    }
    this.agentTouchedAt.set(ctx.actor, { at: nowMs, checkout: caller.checkout });
    ctx.sql.run(
      `INSERT INTO agents (name, firstSeenAt, lastSeenAt, checkout, repo) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         lastSeenAt = excluded.lastSeenAt,
         checkout = CASE WHEN agents.goneAt IS NOT NULL THEN excluded.checkout ELSE COALESCE(agents.checkout, excluded.checkout) END,
         repo = COALESCE(agents.repo, excluded.repo),
         goneAt = NULL`,
      [ctx.actor, ctx.now, ctx.now, caller.checkout ?? null, this.repoFor(ctx, caller.checkout)],
    );
    if (previous === undefined) this.notify([]);
  }

  private applyingChoices = false;

  /**
   * Applies every waiting choice whose time is up. Called on every call and by the server every second, so an Undo
   * window ends on time whether or not anyone is looking.
   */
  applyDueChoices(): void {
    if (this.applyingChoices) return;
    this.applyingChoices = true;
    try {
      const ctx = this.ctx(SYSTEM);
      const before = currentCursor(ctx);
      const due = dueChoices(ctx);
      if (due.length === 0) return;
      this.sql.transaction(() => {
        for (const choice of due) applyChoice(ctx, choice);
        reconcileDrift(ctx, before);
      });
      this.notify(this.eventsSince(before));
    } finally {
      this.applyingChoices = false;
    }
  }

  /** Runs whatever deadline has passed, as Octotrack itself, before anything else is answered. */
  private settleDeadlines(): void {
    const ctx = this.ctx(SYSTEM);
    const before = currentCursor(ctx);
    this.sql.transaction(() => {
      settle(ctx);
      makeRoom(ctx);
    });
    const events = this.eventsSince(before);
    if (events.length > 0) this.notify(events);
  }

  /** Works out which agent is calling, and refuses what it may not do whoever it is. */
  private identify(caller: Caller, writes: boolean): Caller {
    if (caller.system === true || caller.developer === true || caller.channel === "dashboard") return caller;
    const ctx = this.ctx(caller);
    const name = resolveAgent(ctx, caller.actor, caller.anonymous === true, caller.checkout ?? null, writes);
    if (name === null) return caller;
    if (writes) refuseIfStopped(ctx, name);
    return { ...caller, actor: name, anonymous: false };
  }

  /** Hands a caller what it must hear, for replies that do not run an operation, such as a long-polled wait. */
  noticesFor(caller: Caller): Notice[] {
    const who = this.identify(caller, false);
    return this.deliver(this.ctx(who), who);
  }

  private deliver(ctx: Ctx, caller: Caller): Notice[] {
    if (ctx.developer || ctx.system || caller.anonymous === true) return [];
    return this.sql.transaction(() => [
      ...takeNotices(ctx, ctx.actor),
      ...takeInbox(ctx, ctx.actor),
      ...offersFor(ctx, ctx.actor),
    ]);
  }

  private requireOp(name: string): BoundOp {
    const op = this.ops.get(name);
    if (op === undefined) {
      throw new OctoError("unknown_op", `Unknown operation "${name}"`, "Run `octo ops` to list operations.");
    }
    return op;
  }

  /** Runs one operation. `deliver: false` leaves the agent's notices for a reply that will show them. */
  execute(name: string, input: unknown, caller: Caller, options: { deliver?: boolean } = {}): OpOutcome {
    const op = this.requireOp(name);
    this.settleDeadlines();
    this.applyDueChoices();
    const who = this.identify(caller, op.mutates);
    const ctx = this.ctx(who);
    this.touchAgent(ctx, who);
    const deliver = () => (options.deliver === false ? [] : this.deliver(this.ctx(who), who));
    if (!op.mutates) {
      const data = op.run(ctx, input);
      return { data, driftOpened: [], cursor: currentCursor(ctx), notices: deliver() };
    }
    const before = currentCursor(ctx);
    const data: unknown = this.sql.transaction(() => {
      const result = op.run(ctx, input);
      if (!NO_RECONCILE.has(name)) reconcileDrift(ctx, before);
      return result;
    });
    const events = this.eventsSince(before);
    if (!POLLS.has(name) || events.length > 0 || ctx.visibleChange) this.notify(events);
    const saved = name === DRAFT_SAVE ? DraftSaved.safeParse(data) : null;
    if (saved?.success === true) for (const listener of this.draftListeners) listener(saved.data.key);
    return { data, driftOpened: ctx.openedDrift, cursor: currentCursor(ctx), notices: deliver() };
  }

  /** The typed path for server-side callers such as the sweep loop. */
  call<I extends z.ZodType, O extends z.ZodType>(
    contract: Contract<I, O>,
    input: z.input<I>,
    caller: Caller,
  ): z.output<O> {
    return contract.output.parse(this.execute(contract.name, input, caller, { deliver: false }).data);
  }

  batch(request: BatchRequest, caller: Caller): BatchResult {
    if (request.atomic === false) return this.batchIndependent(request.ops, caller);
    return this.batchAtomic(request.ops, caller);
  }

  private batchIndependent(ops: readonly BatchOp[], caller: Caller): BatchResult {
    const aliases = new Map<string, unknown>();
    const driftOpened: Drift[] = [];
    const notices: Notice[] = [];
    const results = ops.map((item) => {
      try {
        const outcome = this.execute(item.op, substitute(item.input, aliases), caller);
        if (item.as !== undefined) aliases.set(item.as, outcome.data);
        driftOpened.push(...outcome.driftOpened);
        notices.push(...outcome.notices);
        return { op: item.op, ok: true, data: outcome.data, error: null };
      } catch (error) {
        return { op: item.op, ok: false, data: null, error: toErrorBody(error) };
      }
    });
    return { ok: results.every((result) => result.ok), results, driftOpened, cursor: this.cursor(), notices };
  }

  private batchAtomic(ops: readonly BatchOp[], caller: Caller): BatchResult {
    this.settleDeadlines();
    const who = this.identify(caller, true);
    const ctx = this.ctx(who);
    const before = currentCursor(ctx);
    const aliases = new Map<string, unknown>();
    const outputs: unknown[] = [];
    const state: {
      failure: { index: number; error: ErrorBody } | null;
    } = { failure: null };
    const rollback = new Error("batch rollback");
    this.touchAgent(ctx, who);
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
        notices: this.deliver(this.ctx(who), who),
      };
    }
    this.notify(this.eventsSince(before));
    return {
      ok: true,
      results: ops.map((item, index) => ({ op: item.op, ok: true, data: outputs[index], error: null })),
      driftOpened: ctx.openedDrift,
      cursor: currentCursor(ctx),
      notices: this.deliver(this.ctx(who), who),
    };
  }

  /** Re-evaluates time-based rules and drops abandoned watches. Run periodically by the server. */
  sweep(): OpOutcome {
    const ctx = this.ctx(SYSTEM);
    this.sql.transaction(() => expireAbandonedWatches(ctx));
    // Last, because it notifies, and the dashboard should then see the watches already gone. This is also how an agent
    // that vanished without saying goodbye stops being shown as waiting: nothing else would ever tell the page.
    return this.execute(contracts.driftScan.name, {}, SYSTEM);
  }
}
