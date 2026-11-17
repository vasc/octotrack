import { contracts as c, PlanStepStatus } from "@octotrack/core";
import { UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact } from "./shared.ts";

const STRING = { type: "string" } as const;

/** A branch's hold, as typed: a step's address, or none. */
function holdsUp(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === "none" ? null : value;
}

/** A line's plan, as a tree: the critical path and its branches (D15). */
export const planCommands: Command[] = [
  {
    path: ["plan", "show"],
    usage: "<LINE>",
    summary: "Show a line's plan as a tree: the critical path, each branch under the step it forks from",
    examples: ["octo plan show L-2"],
    ops: [c.lineShow.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.lineShow, { ref: args.requirePositional(0, "LINE") });
      out.result(outcome, () => r.renderPlan(outcome.data));
    },
  },
  {
    path: ["plan", "set"],
    usage: "<LINE> <step>...",
    summary: "Set a line's critical path: its steps, in order; branches stay on the steps they fork from",
    examples: ['octo plan set L-2 "Model the base" "Print and test-fit" "Final print"'],
    ops: [c.planSet.name],
    async run({ client, out }, args) {
      const line = args.requirePositional(0, "LINE");
      const steps = args.positionals.slice(1);
      if (steps.length === 0) throw new UsageError("Name at least one step");
      const outcome = await client.call(c.planSet, { line, steps });
      out.result(outcome, () => outcome.data.map((step) => `  ${step.address}  ${step.title}`).join("\n"));
    },
  },
  {
    path: ["plan", "step"],
    usage: "<LINE> <step> <todo|doing|done>",
    summary: "Set one step of a line's plan to do, under way or done, by its address: 2, or 2a.1 on a branch",
    examples: ["octo plan step L-2 1 done", "octo plan step L-2 2a.1 doing"],
    ops: [c.planStep.name],
    async run({ client, out }, args) {
      const line = args.requirePositional(0, "LINE");
      const step = args.requirePositional(1, "step");
      const status = PlanStepStatus.safeParse(args.requirePositional(2, "status"));
      if (!status.success) throw new UsageError("<status> is todo, doing or done");
      const outcome = await client.call(c.planStep, { line, step, status: status.data });
      // The steps as data; in words, the whole tree, so the step is seen where it sits.
      const shown = await client.call(c.lineShow, { ref: line });
      out.result(outcome, () => r.renderPlanRows(shown.data));
    },
  },
  {
    path: ["plan", "branch"],
    usage: "<LINE> --from <step> [--holds-up <step>] <title> <step>...",
    summary: "Add a branch: steps that fork from one step and may hold up a later one of the same sequence",
    options: {
      from: { ...STRING, description: "The step it forks from, by address (required)" },
      "holds-up": {
        ...STRING,
        description: "A later step that waits for it; leave out when it holds nothing up",
      },
    },
    examples: ['octo plan branch L-2 --from 2 --holds-up 3 "Order the breakout" "Pick a board" "Order it"'],
    ops: [c.planBranch.name],
    async run({ client, out }, args) {
      const from = args.str("from");
      if (from === undefined) throw new UsageError("Missing --from <step>");
      const [title, ...steps] = args.positionals.slice(1);
      if (title === undefined || steps.length === 0)
        throw new UsageError("Name the branch, then at least one step");
      const outcome = await client.call(
        c.planBranch,
        compact({
          line: args.requirePositional(0, "LINE"),
          from,
          holdsUp: args.str("holds-up"),
          title,
          steps,
        }),
      );
      out.result(outcome, () =>
        outcome.data.map((branch) => `  ${branch.address}  ${branch.title}`).join("\n"),
      );
    },
  },
  {
    path: ["plan", "edit-branch"],
    usage: "<LINE> <branch> [--title <title>] [--holds-up <step>|none] [<step>...]",
    summary:
      "Change a branch: its title, what it holds up, or its steps (a step whose title stays keeps its issues)",
    options: {
      title: { ...STRING, description: "Its new title" },
      "holds-up": { ...STRING, description: "The later step that waits for it, or none" },
    },
    examples: [
      "octo plan edit-branch L-2 2a --holds-up none",
      'octo plan edit-branch L-2 2a "Pick" "Order" "Test"',
    ],
    ops: [c.planBranchUpdate.name],
    async run({ client, out }, args) {
      const steps = args.positionals.slice(2);
      const outcome = await client.call(
        c.planBranchUpdate,
        compact({
          line: args.requirePositional(0, "LINE"),
          branch: args.requirePositional(1, "branch"),
          title: args.str("title"),
          holdsUp: holdsUp(args.str("holds-up")),
          steps: steps.length === 0 ? undefined : steps,
        }),
      );
      out.result(outcome, () =>
        outcome.data.map((branch) => `  ${branch.address}  ${branch.title}`).join("\n"),
      );
    },
  },
  {
    path: ["plan", "remove-branch"],
    usage: "<LINE> <branch>",
    summary: "Remove a branch; its issues go back to the step it forked from",
    examples: ["octo plan remove-branch L-2 4a"],
    ops: [c.planBranchRemove.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.planBranchRemove, {
        line: args.requirePositional(0, "LINE"),
        branch: args.requirePositional(1, "branch"),
      });
      out.result(
        outcome,
        () => `  ${outcome.data.length} branch${outcome.data.length === 1 ? "" : "es"} left`,
      );
    },
  },
  {
    path: ["plan", "promote"],
    usage: "<LINE> <branch> --done-when <sentence>",
    summary:
      "Make a branch its own line: the developer places it (--where), an agent proposes it (--recommend, --why)",
    options: {
      "done-when": { ...STRING, description: "One sentence saying when the new line is finished (required)" },
      title: { ...STRING, description: "Its title, if not the branch's" },
      where: { ...STRING, description: "The developer's: working, up_next (default) or tabled" },
      reason: { ...STRING, description: "Why it is tabled" },
      recommend: { ...STRING, description: "An agent's: start, up_next (default), table" },
      why: { ...STRING, description: "An agent's: why there" },
    },
    examples: ['octo plan promote L-2 3a --done-when "A bracket on the hallway wall holds the case level."'],
    ops: [c.planPromote.name],
    async run({ client, out }, args) {
      const doneWhen = args.str("done-when");
      if (doneWhen === undefined) throw new UsageError('Missing --done-when "<when it is finished>"');
      const outcome = await client.call(
        c.planPromote,
        compact({
          line: args.requirePositional(0, "LINE"),
          branch: args.requirePositional(1, "branch"),
          doneWhen,
          title: args.str("title"),
          where: args.str("where"),
          reason: args.str("reason"),
          recommendation: args.str("recommend"),
          why: args.str("why"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
];
