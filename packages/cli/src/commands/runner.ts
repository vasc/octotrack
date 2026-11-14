import { contracts as c } from "@octotrack/core";
import type { Command } from "../command.ts";
import * as r from "../render.ts";

const STRING = { type: "string" } as const;
const INTERNAL = "The server's runner records this; from the CLI it is refused";

export const runnerCommands: Command[] = [
  {
    path: ["runner", "due"],
    summary: "Working lines due a session, up to the cap",
    ops: [c.runnerDue.name],
    async run({ client, out }) {
      const outcome = await client.call(c.runnerDue, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("Nothing due.")
          : r.table(
              outcome.data.map((due) => [
                r.bold(due.line),
                due.repo,
                due.name ?? "new",
                `try ${due.attempt}`,
              ]),
            ),
      );
    },
  },
  {
    path: ["runner", "retry"],
    usage: "<LINE>",
    summary: "Try now: start a session for a line again without waiting (the developer)",
    ops: [c.runnerRetry.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.runnerRetry, { line: args.requirePositional(0, "LINE") });
      out.result(outcome, () => `Trying ${outcome.data.line} again.`);
    },
  },
  {
    path: ["runner", "closes"],
    summary: "Pull requests still open on lines that ended, which the runner closes",
    ops: [c.runnerCloses.name],
    async run({ client, out }) {
      const outcome = await client.call(c.runnerCloses, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("Nothing to close.")
          : r.table(
              outcome.data.map((close) => [r.bold(close.pr), `${close.repo}#${close.number}`, close.line]),
            ),
      );
    },
  },
  {
    path: ["runner", "cleanups"],
    summary: "Worktrees Octotrack made that no session uses any more",
    ops: [c.runnerCleanups.name],
    async run({ client, out }) {
      const outcome = await client.call(c.runnerCleanups, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("Nothing to remove.")
          : r.table(outcome.data.map((tree) => [tree.path, tree.branch, tree.agent])),
      );
    },
  },
  {
    path: ["runner", "record"],
    usage: "<report|start|exited|dry|closed|worktree|removed>",
    summary: INTERNAL,
    options: { input: { ...STRING, description: "The operation's input, as JSON" } },
    ops: [
      c.runnerReport.name,
      c.runnerStart.name,
      c.runnerExited.name,
      c.runnerDry.name,
      c.runnerClosed.name,
      c.runnerWorktree.name,
      c.runnerRemoved.name,
    ],
    async run({ client, out }, args) {
      const outcome = await client.op(
        `runner.${args.requirePositional(0, "what")}`,
        JSON.parse(args.str("input") ?? "{}"),
      );
      out.result(outcome, () => "Recorded.");
    },
  },
];
