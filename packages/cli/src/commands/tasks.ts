import { contracts as c } from "@octotrack/core";
import { UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact, textOption } from "./shared.ts";

const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

export const taskCommands: Command[] = [
  {
    path: ["task", "file"],
    usage: "<title>",
    summary:
      "File a task for the developer, anything done with their own hands: log in, plug something in, measure something",
    options: {
      place: {
        ...STRING,
        description: "Where it is done, if that matters; a new place is added to the list",
      },
      outcome: { ...STRING, description: "What to send back, if anything; with none, Done needs no words" },
      body: { ...STRING, short: "b", description: "Details" },
      "body-file": { ...STRING, description: "Read details from a file, - for stdin" },
      line: { ...STRING, description: "The line it waits on. Default: yours" },
      frees: { ...STRING, description: "The issue it frees. Default: the one you hold" },
      field: {
        ...MANY,
        description: "A named outcome, each sent back on its own: one line, with no = or :; repeatable",
      },
    },
    examples: [
      'octo task file "Log in to Tailscale on the Mac mini"',
      'octo task file "Log in to Tailscale on the Mac mini" --place "the Mac mini"',
      'octo task file "Measure the grip" --place "the bench" --outcome "The five numbers, in mm"',
      'octo task file "Measure the board" --place "the bench" --outcome "In mm" --field Length --field Holes',
    ],
    ops: [c.taskFile.name],
    async run({ client, out }, args) {
      const filed = await client.call(
        c.taskFile,
        compact({
          title: args.requirePositional(0, "title"),
          place: args.str("place"),
          outcome: args.str("outcome"),
          body: await textOption(args, "body"),
          line: args.str("line"),
          frees: args.str("frees"),
          fields: args.list("field").length === 0 ? undefined : args.list("field"),
        }),
      );
      out.result(
        filed,
        () =>
          `${r.bold(filed.data.ref)} for the developer${filed.data.place === null ? "" : ` at ${filed.data.place}`}: ${filed.data.title}`,
      );
    },
  },
  {
    path: ["task", "reply"],
    usage: "<REF> <words>",
    summary: "Reply to a task: the words go to the agent waiting on it, and the task stays open",
    examples: ['octo task reply PANEL-9 "Its checks are red; fix them first" --me'],
    ops: [c.taskReply.name],
    async run({ client, out }, args) {
      const words = args.positionals.slice(1).join(" ").trim();
      if (words === "") throw new UsageError("Say what to reply");
      const replied = await client.call(c.taskReply, { ref: args.requirePositional(0, "REF"), body: words });
      out.result(replied, () => `Replied on ${r.bold(replied.data.ref)}: ${replied.data.title}`);
    },
  },
  {
    path: ["task", "done"],
    usage: "<REF> [outcome]",
    summary: "Report a task's outcome; it goes to whoever holds the issue it frees",
    options: {
      value: {
        ...MANY,
        description: "A named outcome as Name=value (one line), each one the task asks for; repeatable",
      },
    },
    examples: [
      "octo task done PANEL-6 41 mm --me",
      "octo task done ME-3 --me",
      'octo task done PANEL-7 --value "Length=41 mm" --value Holes=38 --me',
    ],
    ops: [c.taskDone.name],
    async run({ client, out }, args) {
      const values = Object.fromEntries(
        args.list("value").map((pair) => {
          const at = pair.indexOf("=");
          if (at <= 0) throw new UsageError(`--value takes Name=value, not "${pair}"`);
          return [pair.slice(0, at), pair.slice(at + 1)];
        }),
      );
      const note = args.positionals.slice(1).join(" ");
      const outcome = await client.call(
        c.taskDone,
        compact({
          ref: args.requirePositional(0, "REF"),
          result: note === "" ? undefined : note,
          values: Object.keys(values).length === 0 ? undefined : values,
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} done.`);
    },
  },
  {
    path: ["task", "cant"],
    usage: "<REF> <why>",
    summary: "Say a task cannot be done, and why",
    ops: [c.taskCant.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.taskCant, {
        ref: args.requirePositional(0, "REF"),
        why: args.positionals.slice(1).join(" "),
      });
      out.result(outcome, () => `${r.bold(outcome.data.ref)} closed as not done.`);
    },
  },
  {
    path: ["place", "list"],
    summary: "The places the developer does tasks",
    ops: [c.placeList.name],
    async run({ client, out }) {
      const outcome = await client.call(c.placeList, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("No places yet.")
          : outcome.data.map((place) => place.name).join("\n"),
      );
    },
  },
  {
    path: ["place", "add"],
    usage: "<name>",
    summary: "Add a place",
    ops: [c.placeAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.placeAdd, { name: args.positionals.join(" ") });
      out.result(outcome, () => outcome.data.map((place) => place.name).join("\n"));
    },
  },
  {
    path: ["place", "remove"],
    usage: "<name>",
    summary: "Remove a place",
    ops: [c.placeRemove.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.placeRemove, { name: args.positionals.join(" ") });
      out.result(outcome, () => outcome.data.map((place) => place.name).join("\n") || r.dim("No places."));
    },
  },
  {
    path: ["held", "list"],
    usage: "<LINE>",
    summary: "Questions and tasks held on a line, and whether each is still current",
    ops: [c.heldList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.heldList, { line: args.requirePositional(0, "LINE") });
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("Nothing held.")
          : r.table(
              outcome.data.map((item) => [
                r.bold(item.ref),
                item.kind,
                item.current ? "current" : r.yellow("re-confirm or withdraw"),
                item.title,
              ]),
            ),
      );
    },
  },
  {
    path: ["held", "withdraw"],
    usage: "<REF...>",
    summary: "Withdraw held questions or tasks on your line that no longer stand",
    options: { why: { ...STRING, description: "What changed" } },
    ops: [c.heldWithdraw.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.heldWithdraw,
        compact({ refs: args.requirePositionals("REF"), why: args.str("why") }),
      );
      out.result(outcome, () => `Withdrew ${outcome.data.withdrawn.join(", ")}.`);
    },
  },
  {
    path: ["at"],
    usage: "[place]",
    summary: "I'm at a place: home opens its tasks for three hours; with no place, it leaves (the developer)",
    ops: [c.at.name],
    async run({ client, out }, args) {
      const place = args.positionals.join(" ");
      const outcome = await client.call(c.at, place === "" ? {} : { place });
      out.result(outcome, () => {
        const at = outcome.data;
        if (at === null) return "Not at any place.";
        const tasks = at.tasks.map((task) => `${r.bold(task.ref)} ${task.title}`).join("\n");
        return `At ${at.place} until ${at.until.slice(11, 16)}.${tasks === "" ? " Nothing to do here." : `\n${tasks}`}`;
      });
    },
  },
  {
    path: ["task", "add"],
    usage: "<LINE> <title>",
    summary: "Add a task of your own to a line you own",
    options: { place: { ...STRING, description: "One of your places, if it is done at one" } },
    ops: [c.taskAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.taskAdd,
        compact({
          line: args.requirePositional(0, "LINE"),
          title: args.positionals.slice(1).join(" "),
          place: args.str("place"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
  {
    path: ["note", "add"],
    usage: "<LINE> <text>",
    summary: "Add a note to a line you own",
    ops: [c.noteAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.noteAdd, {
        line: args.requirePositional(0, "LINE"),
        body: args.positionals.slice(1).join(" "),
      });
      out.result(outcome, () => `Noted on ${outcome.data.line}.`);
    },
  },
  {
    path: ["held", "confirm"],
    usage: "<REF...>",
    summary: "Say held questions or tasks still stand: current for another 7 days",
    ops: [c.heldConfirm.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.heldConfirm, { refs: args.requirePositionals("REF") });
      out.result(outcome, () => `Re-confirmed ${outcome.data.map((item) => item.ref).join(", ")}.`);
    },
  },
];
