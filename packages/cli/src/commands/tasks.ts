import { contracts as c } from "@octotrack/core";
import { UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact, textOption } from "./shared.ts";

const STRING = { type: "string" } as const;

export const taskCommands: Command[] = [
  {
    path: ["task", "file"],
    usage: "<title>",
    summary: "File a task for the developer: where it is done, what to report, and the issue it frees",
    options: {
      place: { ...STRING, description: "One of the developer's places (required): octo place list" },
      outcome: { ...STRING, description: "What the developer reports when it is done (required)" },
      body: { ...STRING, short: "b", description: "Details" },
      "body-file": { ...STRING, description: "Read details from a file, - for stdin" },
      line: { ...STRING, description: "The line it waits on. Default: yours" },
      frees: { ...STRING, description: "The issue it frees. Default: the one you hold" },
    },
    examples: ['octo task file "Measure the grip" --place "the bench" --outcome "The five numbers, in mm"'],
    ops: [c.taskFile.name],
    async run({ client, out }, args) {
      const place = args.str("place");
      const outcome = args.str("outcome");
      if (place === undefined || outcome === undefined) throw new UsageError("Pass --place and --outcome");
      const filed = await client.call(
        c.taskFile,
        compact({
          title: args.requirePositional(0, "title"),
          place,
          outcome,
          body: await textOption(args, "body"),
          line: args.str("line"),
          frees: args.str("frees"),
        }),
      );
      out.result(
        filed,
        () =>
          `${r.bold(filed.data.ref)} for the developer at ${filed.data.place ?? "?"}: ${filed.data.title}`,
      );
    },
  },
  {
    path: ["task", "done"],
    usage: "<REF> <outcome>",
    summary: "Report a task's outcome; it goes to whoever holds the issue it frees (the developer)",
    ops: [c.taskDone.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.taskDone, {
        ref: args.requirePositional(0, "REF"),
        result: args.positionals.slice(1).join(" "),
      });
      out.result(outcome, () => `${r.bold(outcome.data.ref)} done.`);
    },
  },
  {
    path: ["task", "cant"],
    usage: "<REF> <why>",
    summary: "Say a task cannot be done, and why (the developer)",
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
    summary: "Add a place (the developer)",
    ops: [c.placeAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.placeAdd, { name: args.positionals.join(" ") });
      out.result(outcome, () => outcome.data.map((place) => place.name).join("\n"));
    },
  },
  {
    path: ["place", "remove"],
    usage: "<name>",
    summary: "Remove a place (the developer)",
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
    summary: "Add a task of your own to a line you own (the developer)",
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
    summary: "Add a note to a line you own (the developer)",
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
