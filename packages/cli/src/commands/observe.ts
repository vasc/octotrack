import {
  contracts as c,
  type FeedEvent,
  type WatchClause,
  type WatchResult,
  type WatchSpec,
} from "@octotrack/core";
import { type Args, UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { EXIT_TIMEOUT, runFollow, runOneShot, timeoutFrom, waitForWatches } from "../watching.ts";
import { compact, LIST_OPTIONS, listInput, queryFrom } from "./shared.ts";

const FEED_DEFAULT_LIMIT = 50;
const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

/** Every status that means "not finished yet", across all kinds of item. */
const UNFINISHED =
  "open,draft,backlog,todo,in_progress,in_review,blocked,planned,active,paused,captured,exploring";

const WATCH_OPTIONS = {
  on: { ...MANY, description: "Fire on a new event matching this query. Repeatable" },
  until: { ...MANY, description: "Fire once current state matches this query, even right away. Repeatable" },
  "until-none": { ...MANY, description: "Fire once nothing matches this query any more. Repeatable" },
  all: { type: "boolean", description: "Fire only when every clause holds. Default: any clause" },
  count: { ...STRING, description: "With --on: need this many matching events" },
  since: { ...STRING, description: "With --on: count events after this cursor, from an earlier result" },
  timeout: { ...STRING, description: "Give up after this long, exit 124. For example 30m" },
} as const;

/** A positional ref is shorthand for "tell me when anything touches this". */
export function buildSpec(args: Args): WatchSpec {
  const count = args.int("count");
  const events = [...args.positionals.map((ref) => `ref:${ref}`), ...args.list("on")];
  const clauses: WatchClause[] = [
    ...events.map((query) => ({ type: "event" as const, query, count: count ?? 1 })),
    ...args.list("until").map((query) => ({ type: "state" as const, query, mode: "exists" as const })),
    ...args.list("until-none").map((query) => ({ type: "state" as const, query, mode: "none" as const })),
  ];
  if (clauses.length === 0) throw new UsageError("Say what to watch: a ref, --on, --until or --until-none");
  return { clauses, require: args.flag("all") ? "all" : "any" };
}

export const observeCommands: Command[] = [
  {
    path: ["feed"],
    usage: "[QUERY]",
    summary: "Read the feed, newest first, filtered with the query language. --follow streams it",
    options: {
      ...LIST_OPTIONS,
      view: { ...STRING, description: "Apply a saved view" },
      before: { ...STRING, description: "Older than this sequence number, for paging" },
      after: { ...STRING, description: "Newer than this sequence number" },
      follow: { type: "boolean", short: "f", description: "Keep streaming new matching events" },
      since: { ...STRING, description: "With --follow: start after this cursor, from an earlier result" },
      timeout: WATCH_OPTIONS.timeout,
    },
    examples: [
      'octo feed "kind:decision project:OCT since:1d"',
      "octo feed --view Blockers",
      'octo feed -f "-actor:github"',
    ],
    ops: [c.feedList.name],
    async run(ctx, args) {
      const query = queryFrom(args);
      const view = args.str("view");
      if (args.flag("follow")) {
        const saved = view === undefined ? [] : (await ctx.client.call(c.viewList, {})).data;
        const viewQuery = saved.find((item) => item.name.toLowerCase() === view?.toLowerCase())?.query;
        if (view !== undefined && viewQuery === undefined) {
          throw new UsageError(`No saved view named "${view}". Run octo view list.`);
        }
        const combined = [viewQuery, query]
          .filter((part) => part !== undefined && part !== "")
          .map((part) => `(${part})`)
          .join(" ");
        const spec: WatchSpec = { require: "any", clauses: [{ type: "event", query: combined, count: 1 }] };
        return runFollow(ctx, spec, timeoutFrom(args), args.int("since"));
      }
      // One request scans a bounded stretch of the log, so a rare filter may take several to find anything.
      const limit = args.int("limit") ?? FEED_DEFAULT_LIMIT;
      const events: FeedEvent[] = [];
      let before = args.int("before");
      while (true) {
        const page = await ctx.client.call(
          c.feedList,
          compact({ query, view, limit: limit - events.length, before, after: args.int("after") }),
        );
        events.push(...page.data.events);
        if (events.length >= limit || page.data.nextBefore === null) {
          const data = { ...page.data, events };
          ctx.out.result({ ...page, data }, () => r.renderEvents(events));
          return 0;
        }
        before = page.data.nextBefore;
      }
    },
  },
  {
    path: ["find"],
    usage: "[QUERY]",
    summary: "Search current state across every kind of item",
    options: LIST_OPTIONS,
    examples: ['octo find "kind:issue status:blocked"', "octo find linked:D-3", 'octo find "retry logic"'],
    ops: [c.entityFind.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.entityFind, listInput(args));
      out.result(outcome, () => r.renderSummaries(outcome.data));
    },
  },
  {
    path: ["show"],
    usage: "<REF>",
    summary: "Show any item with its links, drift, updates and history. Accepts owner/repo#12 for PRs",
    ops: [c.entityShow.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.entityShow, { ref: args.requirePositional(0, "REF") });
      out.result(outcome, () => r.renderDetail(outcome.data));
    },
  },
  {
    path: ["view", "save"],
    usage: "<name> <query>",
    summary: "Save a named filter, usable in the dashboard and with octo feed --view",
    ops: [c.viewSave.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.viewSave, {
        name: args.requirePositional(0, "name"),
        query: args.requirePositional(1, "query"),
      });
      out.result(outcome, () => `Saved ${outcome.data.name}.`);
    },
  },
  {
    path: ["view", "list"],
    summary: "List saved filters",
    ops: [c.viewList.name],
    async run({ client, out }) {
      const outcome = await client.call(c.viewList, {});
      out.result(outcome, () => r.renderViews(outcome.data));
    },
  },
  {
    path: ["view", "rm"],
    usage: "<name>",
    summary: "Remove a saved filter",
    ops: [c.viewRemove.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.viewRemove, { name: args.requirePositional(0, "name") });
      out.result(outcome, () => (outcome.data.removed ? "Removed." : "No such view."));
    },
  },
  {
    path: ["watch"],
    usage: "[REF...]",
    summary: "Hang until something happens. Rich clauses, exit 0 when fired, 124 on timeout",
    options: {
      ...WATCH_OPTIONS,
      follow: {
        type: "boolean",
        short: "f",
        description: "Keep streaming matching events. --on clauses only",
      },
    },
    examples: [
      "octo watch D-3                                   # anything touching D-3",
      "octo watch --until 'ref:D-3 status:decided'      # cannot miss it, even if already decided",
      "octo watch --until-none 'ref:D-3,D-4 status:open' # until both are answered",
      "octo watch --on 'kind:pr project:OCT to:merged'  # a PR in OCT merges",
      "octo watch --on 'event:decision.resolved' --on 'checks:failing' --timeout 30m",
      "octo watch --on 'to:passing ref:PR-3' --until 'ref:D-3 status:decided' --all",
    ],
    ops: [c.watchCreate.name, c.watchCheck.name, c.watchCancel.name],
    run(ctx, args) {
      const spec = buildSpec(args);
      const since = args.int("since");
      if (args.flag("follow")) return runFollow(ctx, spec, timeoutFrom(args), since);
      return runOneShot(ctx, {
        spec,
        timeoutMs: timeoutFrom(args),
        ...(since === undefined ? {} : { since }),
      });
    },
  },
  {
    path: ["watch", "start"],
    usage: "[REF...]",
    summary: "Register a named watch and return at once, then carry on working and check it later",
    options: { ...WATCH_OPTIONS, name: { ...STRING, description: "Name to refer to it by (required)" } },
    examples: [
      "octo watch start --name queue --until 'ref:D-3 status:decided'",
      "octo watch start --name ci --on 'ref:PR-3 changed:checks'",
      "octo watch check            # any news? never hangs",
      "octo watch wait queue ci    # hang on both, return when either fires",
    ],
    ops: [c.watchCreate.name],
    async run({ client, out }, args) {
      const name = args.str("name");
      if (name === undefined) throw new UsageError("Missing --name");
      const since = args.int("since");
      const outcome = await client.call(c.watchCreate, compact({ spec: buildSpec(args), name, since }));
      out.result(outcome, () => `Watching as ${r.bold(name)} (${outcome.data.ref}).`);
    },
  },
  {
    path: ["watch", "check"],
    usage: "[NAME...]",
    summary: "Check watches once without hanging. Default: all of this agent's active watches",
    ops: [c.watchCheck.name, c.watchList.name],
    async run({ client, out }, args) {
      let refs = [...args.positionals];
      if (refs.length === 0) {
        const mine = await client.call(c.watchList, { agent: client.actor });
        refs = mine.data.map((watch) => watch.ref);
      }
      if (refs.length === 0) {
        out.data([], () => "No active watches.");
        return 0;
      }
      const outcome = await client.call(c.watchCheck, { refs });
      out.result(outcome, () => r.renderWatchResults(outcome.data));
      return 0;
    },
  },
  {
    path: ["watch", "wait"],
    usage: "<NAME...>",
    summary: "Hang on registered watches. Returns when any fires, or when all have with --all",
    options: { all: WATCH_OPTIONS.all, timeout: WATCH_OPTIONS.timeout },
    ops: [c.watchCheck.name],
    async run({ client, out }, args) {
      const timeoutMs = timeoutFrom(args);
      const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
      let pending = args.requirePositionals("NAME");
      const collected: WatchResult[] = [];
      let cursor = 0;
      while (pending.length > 0) {
        const remaining = deadline === null ? null : deadline - Date.now();
        const outcome = await waitForWatches(client, pending, remaining);
        cursor = outcome.cursor;
        if (outcome.kind === "timeout") {
          out.data(
            { fired: false, reason: "timeout", pending, results: collected, cursor },
            () => "Timed out.",
          );
          return EXIT_TIMEOUT;
        }
        collected.push(...outcome.results);
        if (!args.flag("all")) break;
        const done = new Set(outcome.results.flatMap((result) => [result.watch, result.name]));
        pending = pending.filter((item) => !done.has(item) && !done.has(item.toUpperCase()));
      }
      out.data({ fired: true, results: collected, cursor }, () => r.renderWatchResults(collected));
      return 0;
    },
  },
  {
    path: ["watch", "list"],
    summary: "List watches, and see who is waiting on what",
    options: {
      all: { type: "boolean", description: "Include finished watches" },
      agent: { ...STRING, description: "Only this agent's watches" },
    },
    ops: [c.watchList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.watchList,
        compact({ all: args.flag("all") || undefined, agent: args.str("agent") }),
      );
      out.result(outcome, () => r.renderWatches(outcome.data));
    },
  },
  {
    path: ["watch", "cancel"],
    usage: "<NAME...>",
    summary: "Cancel watches",
    ops: [c.watchCancel.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.watchCancel, { refs: args.requirePositionals("NAME") });
      out.result(outcome, () => `Cancelled ${outcome.data.cancelled.join(", ")}.`);
    },
  },
  {
    path: ["wait"],
    usage: "<REF...>",
    summary: "Hang until items are finished, or reach --status. The simplest way to wait",
    options: {
      status: { ...MANY, description: "Wait for this status instead, repeatable. For example --status done" },
      timeout: WATCH_OPTIONS.timeout,
    },
    examples: [
      "octo wait D-3",
      "octo wait PR-7 --status merged --timeout 2h",
      "octo wait OCT-1 OCT-2 --status done",
    ],
    ops: [c.watchCreate.name, c.watchCheck.name],
    run(ctx, args) {
      const refs = args.requirePositionals("REF");
      const statuses = args.list("status");
      const query =
        statuses.length === 0
          ? `ref:${refs.join(",")} status:${UNFINISHED}`
          : `ref:${refs.join(",")} -status:${statuses.join(",")}`;
      return runOneShot(ctx, {
        spec: { require: "all", clauses: [{ type: "state", query, mode: "none" }] },
        timeoutMs: timeoutFrom(args),
      });
    },
  },
];
