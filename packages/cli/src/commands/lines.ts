import { contracts as c } from "@octotrack/core";
import { type Args, UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact, LIST_OPTIONS, listInput } from "./shared.ts";

const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

const lineFields = {
  "done-when": { ...STRING, description: "One sentence saying when the line is finished (required)" },
  repo: { ...MANY, short: "r", description: "A repo the work happens in, repeatable" },
};

function doneWhen(args: Args): string {
  const value = args.str("done-when");
  if (value === undefined) throw new UsageError('Missing --done-when "<when it is finished>"');
  return value;
}

/** A command that moves a line by its ref and prints where it stands now. */
function moveCommand(word: string, contract: typeof c.lineStart, summary: string): Command {
  return {
    path: ["line", word],
    usage: "<REF>",
    summary,
    examples: [`octo line ${word} L-3 --me`, `octo line ${word} L-3 --said "<the developer's words>"`],
    ops: [contract.name],
    async run({ client, out }, args) {
      const outcome = await client.call(contract, { ref: args.requirePositional(0, "REF") });
      out.result(
        outcome,
        () => `${r.bold(outcome.data.ref)} ${outcome.data.state.replace("_", " ")}: ${outcome.data.title}`,
      );
    },
  };
}

export const lineCommands: Command[] = [
  {
    path: ["lines"],
    summary: "Every line of work: working on, up next, proposed, tabled, done lately",
    ops: [c.homeShow.name],
    async run({ client, out }) {
      const outcome = await client.call(c.homeShow, {});
      out.result(outcome, () => r.renderHome(outcome.data));
    },
  },
  {
    path: ["line", "add"],
    usage: "<title>",
    summary: "Add a line of work where it belongs (the developer)",
    options: {
      ...lineFields,
      where: { ...STRING, description: "working, up_next (default) or tabled" },
      reason: { ...STRING, description: "Why it is tabled" },
      "look-again": { ...STRING, description: "When to look at a tabled line again, YYYY-MM-DD" },
    },
    examples: [
      'octo line add "Garden sensor" --done-when "Readings arrive hourly." -r GARDEN --where working --me',
    ],
    ops: [c.lineAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.lineAdd,
        compact({
          title: args.requirePositional(0, "title"),
          doneWhen: doneWhen(args),
          repos: args.optionalList("repo"),
          where: args.str("where") ?? "up_next",
          reason: args.str("reason"),
          lookAgainAt: args.str("look-again"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
  {
    path: ["line", "propose"],
    usage: "<title>",
    summary: "Propose a line of work, saying where you think it goes and why",
    options: {
      ...lineFields,
      recommend: { ...STRING, description: "start, up_next, table or fold (required)" },
      why: { ...STRING, description: "Why, in a sentence the developer can act on (required)" },
      place: { ...STRING, description: "start or queue it at once; needs --said with the developer's words" },
    },
    examples: [
      'octo line propose "Wall mount" --done-when "It hangs flush." -r PANEL --recommend up_next --why "The base is final."',
    ],
    ops: [c.linePropose.name],
    async run({ client, out }, args) {
      const recommendation = args.str("recommend");
      const why = args.str("why");
      if (recommendation === undefined || why === undefined)
        throw new UsageError("Pass --recommend and --why");
      const outcome = await client.call(
        c.linePropose,
        compact({
          title: args.requirePositional(0, "title"),
          doneWhen: doneWhen(args),
          repos: args.optionalList("repo"),
          recommendation,
          why,
          place: args.str("place"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} proposed: ${outcome.data.title}`);
    },
  },
  moveCommand("start", c.lineStart, "Start a line: it joins the bottom of working on"),
  moveCommand("queue", c.lineQueue, "Move a line to the end of up next"),
  moveCommand("done", c.lineDone, "Finish a line"),
  moveCommand("drop", c.lineDrop, "Drop a line"),
  moveCommand("reject", c.lineReject, "Not a line: drop a proposal"),
  {
    path: ["line", "table"],
    usage: "<REF>",
    summary: "Table a line, saying why",
    options: {
      reason: { ...STRING, description: "Why not now (required)" },
      "look-again": { ...STRING, description: "When to look again, YYYY-MM-DD" },
    },
    examples: ['octo line table L-4 --reason "The disk is not tight" --look-again 2027-02-01 --me'],
    ops: [c.lineTable.name],
    async run({ client, out }, args) {
      const reason = args.str("reason");
      if (reason === undefined) throw new UsageError('Missing --reason "<why not now>"');
      const outcome = await client.call(
        c.lineTable,
        compact({ ref: args.requirePositional(0, "REF"), reason, lookAgainAt: args.str("look-again") }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} tabled: ${outcome.data.title}`);
    },
  },
  {
    path: ["line", "fold"],
    usage: "<REF>",
    summary: "Fold a line into another: its issues move there and it ends",
    options: { into: { ...STRING, description: "The line it folds into (required)" } },
    ops: [c.lineFold.name],
    async run({ client, out }, args) {
      const into = args.str("into");
      if (into === undefined) throw new UsageError("Missing --into <REF>");
      const outcome = await client.call(c.lineFold, { ref: args.requirePositional(0, "REF"), into });
      out.result(outcome, () => `${r.bold(outcome.data.ref)} folded into ${into}`);
    },
  },
  {
    path: ["line", "order"],
    usage: "<REF>",
    summary: "Move a line within its section",
    options: {
      top: { type: "boolean", description: "To the top" },
      bottom: { type: "boolean", description: "To the bottom" },
      before: { ...STRING, description: "Just before this line" },
      after: { ...STRING, description: "Just after this line" },
    },
    examples: ["octo line order L-7 --top --me", "octo line order L-7 --after L-2 --me"],
    ops: [c.lineOrder.name],
    async run({ client, out }, args) {
      const to = args.flag("top") ? "top" : args.flag("bottom") ? "bottom" : undefined;
      const outcome = await client.call(
        c.lineOrder,
        compact({
          ref: args.requirePositional(0, "REF"),
          to,
          before: args.str("before"),
          after: args.str("after"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} moved`);
    },
  },
  {
    path: ["line", "show"],
    usage: "<REF>",
    summary: "Show a line with its plan and its issues",
    ops: [c.lineShow.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.lineShow, { ref: args.requirePositional(0, "REF") });
      out.result(outcome, () => r.renderLine(outcome.data));
    },
  },
  {
    path: ["line", "list"],
    usage: "[QUERY]",
    summary: "List lines of work, ended ones included",
    options: { ...LIST_OPTIONS, status: { ...MANY, description: "Filter by state" } },
    ops: [c.lineList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.lineList, listInput(args, ["status"]));
      out.result(outcome, () => r.renderLines(outcome.data));
    },
  },
  {
    path: ["line", "take"],
    usage: "[REF]",
    summary: "Take a line: with no ref, the line you should be on. Says what to do next",
    examples: ["octo line take", "octo line take L-7"],
    ops: [c.lineTake.name],
    async run({ client, out }, args) {
      const ref = args.positionals[0];
      const outcome = await client.call(c.lineTake, ref === undefined ? {} : { ref });
      out.result(outcome, () => r.renderTake(outcome.data));
    },
  },
  {
    path: ["line", "release"],
    summary: "Leave your line",
    ops: [c.lineRelease.name],
    async run({ client, out }) {
      const outcome = await client.call(c.lineRelease, {});
      out.result(outcome, () =>
        outcome.data.line === null ? "You were on no line." : `Left ${outcome.data.line}.`,
      );
    },
  },
  {
    path: ["plan", "set"],
    usage: "<LINE> <step>...",
    summary: "Set a line's plan: its steps, in order",
    examples: ['octo plan set L-2 "Model the base" "Print and test-fit" "Final print"'],
    ops: [c.planSet.name],
    async run({ client, out }, args) {
      const line = args.requirePositional(0, "LINE");
      const steps = args.positionals.slice(1);
      if (steps.length === 0) throw new UsageError("Name at least one step");
      const outcome = await client.call(c.planSet, { line, steps });
      out.result(outcome, () => outcome.data.map((step) => `  ${step.position}. ${step.title}`).join("\n"));
    },
  },
];
