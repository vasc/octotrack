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
    options: {
      same: { type: "boolean", description: "Also every other line whose start stopped the same way" },
      anyway: { type: "boolean", description: "Start one anyway, past the cap, once" },
    },
    ops: [c.runnerRetry.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.runnerRetry, {
        line: args.requirePositional(0, "LINE"),
        ...(args.flag("same") ? { same: true } : {}),
        ...(args.flag("anyway") ? { anyway: true } : {}),
      });
      out.result(outcome, () => `Trying ${outcome.data.lines.join(", ")} again.`);
    },
  },
  {
    path: ["runner", "stops"],
    summary: "Agents the developer stopped whose stop command has not run yet",
    ops: [c.runnerStops.name],
    async run({ client, out }) {
      const outcome = await client.call(c.runnerStops, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("Nothing to stop.")
          : outcome.data.map((stop) => stop.name).join("\n"),
      );
    },
  },
  {
    path: ["repo", "checkout"],
    usage: "<REPO> <path>",
    summary: "Set a repo's main checkout on this machine, where new worktrees are made (the developer)",
    ops: [c.repoCheckout.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.repoCheckout, {
        repo: args.requirePositional(0, "REPO"),
        path: args.requirePositional(1, "path"),
      });
      out.result(
        outcome,
        () => `${r.bold(outcome.data.ref)} is checked out at ${outcome.data.checkout ?? ""}.`,
      );
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
    usage: "<report|start|exited|restarted|dry|closed|worktree|removed|stop_ran>",
    summary: INTERNAL,
    options: { input: { ...STRING, description: "The operation's input, as JSON" } },
    ops: [
      c.runnerReport.name,
      c.runnerStart.name,
      c.runnerExited.name,
      c.runnerRestarted.name,
      c.runnerDry.name,
      c.runnerClosed.name,
      c.runnerWorktree.name,
      c.runnerRemoved.name,
      c.runnerStopRan.name,
    ],
    async run({ client, out }, args) {
      const outcome = await client.op(
        `runner.${args.requirePositional(0, "what")}`,
        JSON.parse(args.str("input") ?? "{}"),
      );
      out.result(outcome, () => "Recorded.");
    },
  },
  {
    path: ["push", "seen"],
    summary: "Say you have looked, so each line may buzz your phone once more (the developer)",
    ops: [c.pushSeen.name],
    async run({ client, out }) {
      const outcome = await client.call(c.pushSeen, {});
      out.result(outcome, () => "Noted.");
    },
  },
  {
    path: ["push", "unsubscribe"],
    usage: "<endpoint>",
    summary: "Stop buzzing a browser (the developer)",
    ops: [c.pushUnsubscribe.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.pushUnsubscribe, {
        endpoint: args.requirePositional(0, "endpoint"),
      });
      out.result(outcome, () => "Stopped.");
    },
  },
  {
    path: ["push", "record"],
    usage: "<subscribe|subscriptions|due|sent>",
    summary: "The dashboard and the server record these; from the CLI they are refused or need the developer",
    options: { input: { ...STRING, description: "The operation's input, as JSON" } },
    ops: [c.pushSubscribe.name, c.pushSubscriptions.name, c.pushDue.name, c.pushSent.name],
    async run({ client, out }, args) {
      const outcome = await client.op(
        `push.${args.requirePositional(0, "what")}`,
        JSON.parse(args.str("input") ?? "{}"),
      );
      out.result(outcome, () => JSON.stringify(outcome.data, null, 2));
    },
  },
];
