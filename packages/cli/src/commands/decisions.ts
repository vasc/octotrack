import { contracts as c, normalizeRef, type WatchSpec } from "@octotrack/core";
import { z } from "zod";
import { UsageError, type Args } from "../args.ts";
import type { Command, RunContext } from "../command.ts";
import * as r from "../render.ts";
import { EXIT_TIMEOUT, runOneShot, timeoutFrom } from "../watching.ts";
import { compact, LIST_OPTIONS, listInput, textOption } from "./shared.ts";

const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

/** Parses `key=Label` or `key=Label::longer description`. */
export function parseOption(raw: string): { key: string; label: string; description?: string } {
  const split = raw.indexOf("=");
  if (split <= 0) throw new UsageError(`--option must look like key=Label, got "${raw}"`);
  const key = raw.slice(0, split);
  const rest = raw.slice(split + 1);
  const descriptionAt = rest.indexOf("::");
  if (descriptionAt === -1) return { key, label: rest };
  return { key, label: rest.slice(0, descriptionAt), description: rest.slice(descriptionAt + 2) };
}

function optionsFrom(args: Args) {
  const raw = args.list("option");
  return raw.length === 0 ? undefined : raw.map(parseOption);
}

/** Hangs until a decision is no longer open, then reports how it came out. */
async function waitForDecisions(ctx: RunContext, rawRefs: readonly string[], args: Args): Promise<number> {
  const refs = rawRefs.map(normalizeRef);
  const spec: WatchSpec = {
    require: "all",
    clauses: [{ type: "state", query: `ref:${refs.join(",")} status:open`, mode: "none" }],
  };
  const quiet = { ...ctx, out: { ...ctx.out, data: () => {}, line: () => {} } };
  const code = await runOneShot(quiet, { spec, timeoutMs: timeoutFrom(args) });
  if (code === EXIT_TIMEOUT) {
    ctx.out.data(
      { fired: false, reason: "timeout", refs },
      () => `Timed out waiting for ${refs.join(", ")}.`,
    );
    return code;
  }
  const decisions = await Promise.all(refs.map((ref) => ctx.client.call(c.entityShow, { ref })));
  const details = decisions.map((outcome) => c.decisionResolve.output.parse(outcome.data.entity));
  // The human resolved it, so this is the only place the waiting agent can learn what it now has to re-check.
  const driftToClear = decisions.flatMap((outcome) =>
    outcome.data.drift.filter((item) => item.status === "open" && refs.includes(item.cause ?? "")),
  );
  ctx.out.data({ fired: true, decisions: details, driftToClear }, () =>
    [details.map(r.renderDecisionBlock).join("\n\n"), r.renderDriftNotice(driftToClear)]
      .filter((part) => part !== "")
      .join("\n\n"),
  );
  return 0;
}

const BatchItems = z.array(
  z.object({
    ref: z.string(),
    option: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    decidedAt: z.string().optional(),
    sourceUrl: z.string().optional(),
  }),
);

function looksLikeJson(text: string): boolean {
  return text.trimStart().startsWith("[");
}

const decisionFields = {
  kind: { ...STRING, description: "technical, architecture, product, approval" },
  priority: { ...STRING, description: "urgent, high, medium, low, none" },
  project: { ...STRING, short: "p", description: "Project key" },
  context: { ...STRING, description: "Background the decider needs" },
  "context-file": { ...STRING, description: "Read context from a file, - for stdin" },
  option: { ...MANY, short: "o", description: "An option: key=Label or key=Label::description. Repeatable" },
  recommend: { ...STRING, description: "The option key you would pick" },
  due: { ...STRING, description: "When it is needed by" },
};

export const decisionCommands: Command[] = [
  {
    path: ["decision", "ask"],
    usage: "<title>",
    summary: "Ask the developer for a decision; --wait hangs until it is answered",
    options: {
      ...decisionFields,
      blocks: { ...MANY, description: "Work that cannot proceed until this is decided, repeatable" },
      affects: { ...MANY, description: "Items to re-check once this is decided, repeatable" },
      wait: { type: "boolean", short: "w", description: "Hang until the decision is made, then print it" },
      wake: { ...STRING, description: "Wake this session when answered, as adapter:address. See octo guide" },
      timeout: { ...STRING, description: "With --wait: give up after this long, exit 124. For example 30m" },
    },
    examples: [
      'octo decision ask "Which queue?" -p OCT -o sqs=SQS -o redis="Redis::Cheaper, less durable" --recommend redis --blocks OCT-4 --wait',
    ],
    ops: [c.decisionAsk.name],
    async run(ctx, args) {
      const outcome = await ctx.client.call(
        c.decisionAsk,
        compact({
          title: args.requirePositional(0, "title"),
          context: await textOption(args, "context"),
          kind: args.str("kind"),
          priority: args.str("priority"),
          project: args.str("project"),
          options: optionsFrom(args),
          recommendation: args.str("recommend"),
          dueAt: args.str("due"),
          blocks: args.optionalList("blocks"),
          affects: args.optionalList("affects"),
          wake: args.str("wake"),
        }),
      );
      if (args.flag("wait")) return waitForDecisions(ctx, [outcome.data.ref], args);
      ctx.out.result(outcome, () => r.renderDecisionBlock(outcome.data));
      return 0;
    },
  },
  {
    path: ["decision", "wait"],
    usage: "<REF...>",
    summary: "Hang until these decisions are no longer open, then print the outcomes",
    options: { timeout: { ...STRING, description: "Give up after this long, exit 124. For example 30m" } },
    examples: ["octo decision wait D-3 D-4 --timeout 2h"],
    ops: [c.entityShow.name, c.watchCreate.name, c.watchCheck.name],
    run: (ctx, args) => waitForDecisions(ctx, args.requirePositionals("REF"), args),
  },
  {
    path: ["decision", "update"],
    usage: "<REF>",
    summary: "Refine an open decision",
    options: {
      ...decisionFields,
      title: { ...STRING, description: "New title" },
      "no-project": { type: "boolean", description: "Detach from its project" },
      "if-version": { ...STRING, description: "Only if still at this version" },
    },
    ops: [c.decisionUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionUpdate,
        compact({
          ref: args.requirePositional(0, "REF"),
          title: args.str("title"),
          context: await textOption(args, "context"),
          kind: args.str("kind"),
          priority: args.str("priority"),
          project: args.flag("no-project") ? null : args.str("project"),
          options: optionsFrom(args),
          recommendation: args.str("recommend"),
          dueAt: args.str("due"),
          ifVersion: args.int("if-version"),
        }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "resolve"],
    usage: "<REF> [option]",
    summary: "Record the outcome of a decision",
    options: {
      option: { ...STRING, short: "o", description: "The chosen option key" },
      note: { ...STRING, short: "n", description: "Why, or the answer when no option applies" },
      "out-of-band": { type: "boolean", description: "It was decided elsewhere, this just records it" },
      at: { ...STRING, description: "When it was really decided" },
      source: { ...STRING, description: "Link to where it was decided" },
      force: { type: "boolean", description: "Change an outcome already recorded" },
    },
    examples: ['octo decision resolve D-3 redis -n "Cost matters more here"'],
    ops: [c.decisionResolve.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionResolve,
        compact({
          ref: args.requirePositional(0, "REF"),
          option: args.str("option") ?? args.positionals[1],
          note: args.str("note"),
          channel: args.flag("out-of-band") ? "out_of_band" : undefined,
          decidedAt: args.str("at"),
          sourceUrl: args.str("source"),
          force: args.flag("force") || undefined,
        }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "batch"],
    summary: "Record many outcomes at once, from lines or JSON, on stdin or from a file",
    options: {
      file: { ...STRING, short: "f", description: "Read from this file instead of stdin" },
      channel: { ...STRING, description: "out_of_band (default), cli or dashboard" },
    },
    examples: [
      "printf 'D-3 redis Cost wins\\nD-4 a\\nD-5 - Doing neither\\n' | octo decision batch",
      'octo decision batch -f outcomes.json   # [{"ref":"D-3","option":"redis","note":"..."}]',
    ],
    ops: [c.decisionResolveBatch.name],
    async run({ client, out }, args) {
      const file = args.str("file");
      const text = file === undefined ? await Bun.stdin.text() : await Bun.file(file).text();
      const parsed: unknown = looksLikeJson(text) ? JSON.parse(text) : undefined;
      const outcome = await client.call(
        c.decisionResolveBatch,
        compact({
          items: parsed === undefined ? undefined : BatchItems.parse(parsed),
          text: parsed === undefined ? text : undefined,
          channel: args.str("channel"),
        }),
      );
      const allOk = outcome.data.results.every((item) => item.ok);
      out.result(
        outcome,
        () =>
          outcome.data.results
            .map((item) =>
              item.ok ? `${r.green("ok")} ${item.ref}` : `${r.red("failed")} ${item.ref}: ${item.error}`,
            )
            .join("\n"),
        allOk,
      );
      return allOk ? 0 : 1;
    },
  },
  {
    path: ["decision", "record"],
    usage: "<title>",
    summary: "Log a decision that was already made somewhere else",
    options: {
      chosen: { ...STRING, description: "What was decided (required)" },
      note: { ...STRING, short: "n", description: "Why" },
      context: { ...STRING, description: "Background" },
      "context-file": { ...STRING, description: "Read context from a file, - for stdin" },
      kind: decisionFields.kind,
      project: decisionFields.project,
      at: { ...STRING, description: "When it was decided" },
      source: { ...STRING, description: "Link to where it was decided" },
      affects: { ...MANY, description: "Items to re-check, repeatable" },
      blocks: { ...MANY, description: "Items it was blocking, repeatable" },
    },
    examples: [
      'octo decision record "Use SQLite locally" --chosen SQLite -p OCT --kind architecture --at 2026-11-01',
    ],
    ops: [c.decisionRecord.name],
    async run({ client, out }, args) {
      const chosen = args.str("chosen");
      if (chosen === undefined) throw new UsageError("Missing --chosen");
      const outcome = await client.call(
        c.decisionRecord,
        compact({
          title: args.requirePositional(0, "title"),
          chosen,
          note: args.str("note"),
          context: await textOption(args, "context"),
          kind: args.str("kind"),
          project: args.str("project"),
          decidedAt: args.str("at"),
          sourceUrl: args.str("source"),
          affects: args.optionalList("affects"),
          blocks: args.optionalList("blocks"),
        }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "reopen"],
    usage: "<REF>",
    summary: "Reopen a decision",
    options: { note: { ...STRING, short: "n", description: "Why" } },
    ops: [c.decisionReopen.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionReopen,
        compact({ ref: args.requirePositional(0, "REF"), note: args.str("note") }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["inbox"],
    summary: "Answers you have not picked up yet. Check this when you start or resume",
    options: { all: { type: "boolean", description: "Every agent's, not only yours" } },
    ops: [c.decisionInbox.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionInbox, compact({ all: args.flag("all") || undefined }));
      out.result(outcome, () => r.renderInbox(outcome.data));
    },
  },
  {
    path: ["decision", "pickup"],
    usage: "<REF>",
    summary: "Acknowledge an answer, taking it out of your inbox",
    ops: [c.decisionPickup.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionPickup, { ref: args.requirePositional(0, "REF") });
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "report"],
    usage: "<REF> <what happened>",
    summary: "Say what became of an answer, so that the developer can see it was carried out",
    options: { partial: { type: "boolean", description: "Only part of it is done. Say what is left" } },
    examples: ['octo decision report D-3 "Removed from the repo, the host file remains" --partial'],
    ops: [c.decisionReport.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionReport, {
        ref: args.requirePositional(0, "REF"),
        note: args.requirePositional(1, "what happened"),
        status: args.flag("partial") ? "partial" : "done",
      });
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "wake"],
    usage: "<REF> [adapter:address]",
    summary: "Ask to be woken when this is answered, or stop asking with --off",
    options: { off: { type: "boolean", description: "Do not wake anyone" } },
    ops: [c.decisionWake.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionWake, {
        ref: args.requirePositional(0, "REF"),
        address: args.flag("off") ? null : args.requirePositional(1, "adapter:address"),
      });
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "wakes"],
    summary: "Answered decisions whose session is due a wake",
    ops: [c.decisionWakes.name],
    async run({ client, out }) {
      const outcome = await client.call(c.decisionWakes, {});
      out.result(outcome, () => r.renderDecisions(outcome.data));
    },
  },
  {
    path: ["decision", "woken"],
    usage: "<REF>",
    summary: "Record that a wake was attempted. The server does this itself",
    options: { error: { ...STRING, description: "Why it failed" } },
    ops: [c.decisionWoken.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionWoken,
        compact({ ref: args.requirePositional(0, "REF"), error: args.str("error") }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "postpone"],
    usage: "<REF>",
    summary: "Push a decision to the bottom of the queue without answering it",
    options: { undo: { type: "boolean", description: "Bring it back to its normal place" } },
    ops: [c.decisionPostpone.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionPostpone,
        compact({ ref: args.requirePositional(0, "REF"), undo: args.flag("undo") || undefined }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "withdraw"],
    usage: "<REF>",
    summary: "Withdraw an open decision that is no longer needed",
    options: { note: { ...STRING, short: "n", description: "Why" } },
    ops: [c.decisionWithdraw.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.decisionWithdraw,
        compact({ ref: args.requirePositional(0, "REF"), note: args.str("note") }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "supersede"],
    usage: "<REF> --by <REF>",
    summary: "Mark a decision as replaced by another",
    options: {
      by: { ...STRING, description: "The replacing decision (required)" },
      note: { ...STRING, short: "n", description: "Why" },
    },
    ops: [c.decisionSupersede.name],
    async run({ client, out }, args) {
      const by = args.str("by");
      if (by === undefined) throw new UsageError("Missing --by");
      const outcome = await client.call(
        c.decisionSupersede,
        compact({ ref: args.requirePositional(0, "REF"), by, note: args.str("note") }),
      );
      out.result(outcome, () => r.renderDecisionBlock(outcome.data));
    },
  },
  {
    path: ["decision", "list"],
    usage: "[QUERY]",
    summary: "List decisions",
    options: {
      ...LIST_OPTIONS,
      status: { ...MANY, description: "Filter by status" },
      type: { ...MANY, description: "Filter by kind: technical, architecture, product, approval" },
      project: { ...MANY, short: "p", description: "Filter by project" },
    },
    examples: ["octo decision list --type architecture"],
    ops: [c.decisionList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionList, listInput(args, ["status", "type", "project"]));
      out.result(outcome, () => r.renderDecisions(outcome.data));
    },
  },
  {
    path: ["decision", "queue"],
    usage: "[QUERY]",
    summary: "Open decisions, most important first, with the reasons why",
    options: { ...LIST_OPTIONS, project: { ...MANY, short: "p", description: "Filter by project" } },
    ops: [c.decisionQueue.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.decisionQueue, listInput(args, ["project"]));
      out.result(outcome, () => r.renderQueue(outcome.data));
    },
  },
];
