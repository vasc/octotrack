import { writeFileSync } from "node:fs";
import { BatchOp, contracts as c, type Counts } from "@octotrack/core";
import { DEFAULT_PORT, serverLogPath, serverStoppedPath, serverUrl, startServer } from "@octotrack/server";
import { z } from "zod";
import { UsageError } from "../args.ts";
import { ConnectionError, RemoteError } from "../client.ts";
import type { Command } from "../command.ts";
import { AGENT_GUIDE } from "../guide.ts";
import * as r from "../render.ts";
import { seedDemo } from "../seed.ts";
import { compact } from "./shared.ts";

const STRING = { type: "string" } as const;
const EXIT_UNREACHABLE = 3;

const Health = z.object({ ok: z.boolean(), cursor: z.number(), pid: z.number().nullable() });
const OpList = z.object({
  data: z.array(z.object({ name: z.string(), summary: z.string(), mutates: z.boolean() })),
});
const OpDetail = z.object({ data: z.unknown() });

function renderCounts(counts: Counts): string {
  const attention = (value: number, label: string) =>
    value > 0 ? r.yellow(`${value} ${label}`) : r.dim(`0 ${label}`);
  return [
    attention(counts.openDecisions, counts.openDecisions === 1 ? "decision open" : "decisions open"),
    attention(counts.openDrift, "drift"),
    attention(counts.failingPrs, counts.failingPrs === 1 ? "PR failing" : "PRs failing"),
    `${counts.openPrs} ${counts.openPrs === 1 ? "PR" : "PRs"} open`,
    `${counts.activeIssues} ${counts.activeIssues === 1 ? "issue" : "issues"} active`,
    attention(counts.blockedIssues, "blocked"),
    attention(counts.waitingWatches, counts.waitingWatches === 1 ? "agent waiting" : "agents waiting"),
  ].join("  ");
}

export const systemCommands: Command[] = [
  {
    path: ["status"],
    summary: "One screen: what needs the developer, and how things stand",
    ops: [c.dashboardBootstrap.name],
    async run({ client, out }) {
      const outcome = await client.call(c.dashboardBootstrap, {});
      const { counts, queue, prs, watches, syncFailures } = outcome.data;
      out.result(outcome, () =>
        [
          renderCounts(counts),
          ...syncFailures.map((failure) => r.red(`PR status is stale for ${failure.repo}: ${failure.error}`)),
          "",
          r.bold("Decisions"),
          r.renderQueue(queue.slice(0, 10)),
          "",
          r.bold("Pull requests"),
          r.renderPrs(
            prs.filter((card) => card.pr.state === "open" || card.pr.state === "draft").slice(0, 10),
          ),
          ...(watches.length > 0 ? ["", r.bold("Agents waiting"), r.renderWatches(watches)] : []),
        ].join("\n"),
      );
    },
  },
  {
    path: ["next"],
    summary: "What this agent should do now",
    options: {
      for: { ...STRING, description: "Ask on behalf of another agent" },
      project: { ...STRING, short: "p", description: "Only this project" },
      limit: { ...STRING, description: "How many items per section" },
    },
    ops: [c.next.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.next,
        compact({ agent: args.str("for"), project: args.str("project"), limit: args.int("limit") }),
      );
      out.result(outcome, () => r.renderNext(outcome.data));
    },
  },
  {
    path: ["roadmap"],
    summary: "Generate a now/next/later roadmap from milestones, projects and ideas",
    options: {
      project: { ...STRING, short: "p", description: "Limit to one project" },
      write: { ...STRING, description: "Write the markdown to this file" },
    },
    examples: ["octo roadmap -p OCT", "octo roadmap --write ROADMAP.md"],
    ops: [c.roadmapGenerate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.roadmapGenerate, compact({ project: args.str("project") }));
      const file = args.str("write");
      if (file !== undefined) await Bun.write(file, outcome.data.markdown);
      out.result(outcome, () => (file === undefined ? r.renderRoadmap(outcome.data) : `Wrote ${file}.`));
    },
  },
  {
    path: ["agent", "list"],
    summary: "List agents and when they were last active",
    ops: [c.agentList.name],
    async run({ client, out }) {
      const outcome = await client.call(c.agentList, {});
      out.result(outcome, () =>
        outcome.data.length === 0
          ? r.dim("No agents yet.")
          : r.table(
              outcome.data.map((agent) => [
                r.bold(agent.name),
                agent.lastSeenAt.slice(0, 16),
                agent.note ?? "",
              ]),
            ),
      );
    },
  },
  {
    path: ["agent", "note"],
    usage: "<text>",
    summary: "Say what this agent is working on, shown in the dashboard",
    options: { clear: { type: "boolean", description: "Remove the note" } },
    ops: [c.agentNote.name],
    async run({ client, out }, args) {
      const note = args.flag("clear") ? null : args.requirePositional(0, "text");
      const outcome = await client.call(c.agentNote, { note });
      out.result(outcome, () => `${outcome.data.name}: ${outcome.data.note ?? "(no note)"}`);
    },
  },
  {
    path: ["fields"],
    summary: "List the query language fields",
    ops: [c.systemFields.name],
    async run({ client, out }) {
      const outcome = await client.call(c.systemFields, {});
      out.result(outcome, () =>
        r.table(outcome.data.map((field) => [r.bold(field.name), field.description])),
      );
    },
  },
  {
    path: ["ops"],
    usage: "[name]",
    summary: "List every operation, or show one with its input and output schemas",
    ops: [],
    async run({ client, out }, args) {
      const name = args.positionals[0];
      if (name === undefined) {
        const { data } = OpList.parse(await client.get("/api/ops"));
        out.data(data, () =>
          r.table(data.map((op) => [r.bold(op.name), op.mutates ? "write" : r.dim("read"), op.summary])),
        );
        return 0;
      }
      const { data } = OpDetail.parse(await client.get(`/api/ops/${name}`));
      out.data(data, () => JSON.stringify(data, null, 2));
      return 0;
    },
  },
  {
    path: ["op"],
    usage: "<name>",
    summary: "Run any operation with JSON input. Reaches everything",
    options: {
      input: { ...STRING, short: "i", description: "JSON input. Without it, read from stdin when piped" },
    },
    examples: [`octo op issue.update --input '{"refs":["OCT-1"],"status":"done"}'`],
    ops: [],
    async run({ client, out }, args) {
      const name = args.requirePositional(0, "name");
      const inline = args.str("input");
      const text = inline ?? (process.stdin.isTTY ? "{}" : await Bun.stdin.text());
      const input: unknown = JSON.parse(text.trim() === "" ? "{}" : text);
      const outcome = await client.op(name, input);
      out.result(outcome, () => JSON.stringify(outcome.data, null, 2));
    },
  },
  {
    path: ["batch"],
    summary: "Run many operations in one call: JSON array or one op per line, from stdin or a file",
    options: {
      file: { ...STRING, short: "f", description: "Read from this file instead of stdin" },
      "keep-going": { type: "boolean", description: "Each op stands alone. Default: all or nothing" },
    },
    examples: [
      `echo '[{"op":"issue.create","as":"a","input":{"project":"OCT","title":"One"}},{"op":"update.post","input":{"body":"Started","target":"$a.ref"}}]' | octo batch`,
    ],
    ops: [],
    async run({ client, out }, args) {
      const file = args.str("file");
      const text = (file === undefined ? await Bun.stdin.text() : await Bun.file(file).text()).trim();
      if (text === "") throw new UsageError("Nothing to run. Pipe in a JSON array of {op, input, as}");
      const raw: unknown = text.startsWith("[")
        ? JSON.parse(text)
        : text
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line): unknown => JSON.parse(line));
      const ops = z.array(BatchOp).parse(raw);
      const result = await client.batch({ ops, atomic: !args.flag("keep-going") });
      out.line(result, () =>
        result.results
          .map((item) => {
            if (item.ok) return `${r.green("ok")} ${item.op}`;
            return `${item.error?.code === "rolled_back" ? r.dim("rolled back") : r.red("failed")} ${item.op}: ${item.error?.message ?? ""}`;
          })
          .join("\n"),
      );
      if (!out.json) {
        const notice = r.renderDriftNotice(result.driftOpened);
        if (notice !== "") console.error(notice);
      }
      return result.ok ? 0 : 1;
    },
  },
  {
    path: ["guide"],
    summary: "The agent playbook. Point agents at this, or paste it into their instructions",
    ops: [],
    async run() {
      console.log(AGENT_GUIDE);
    },
  },
  {
    path: ["serve"],
    summary: "Run the server in the foreground. Other commands start it on demand",
    options: { port: { ...STRING, description: `Port, default ${DEFAULT_PORT}` } },
    ops: [],
    async run(_ctx, args) {
      const port = args.int("port") ?? DEFAULT_PORT;
      const server = startServer(port);
      console.log(`Octotrack on ${server.url}`);
      await new Promise(() => {});
    },
  },
  {
    path: ["server", "status"],
    summary: "Is the server up?",
    ops: [],
    async run({ client, out }) {
      try {
        const health = Health.parse(await client.withoutAutoStart().get("/api/health"));
        out.data(
          { ...health, up: true, url: client.baseUrl, log: serverLogPath() },
          () => `Up at ${client.baseUrl}, pid ${health.pid ?? "?"}, cursor ${health.cursor}.`,
        );
        return 0;
      } catch (error) {
        if (!(error instanceof ConnectionError)) throw error;
        out.data({ up: false, url: client.baseUrl }, () => `Down. Any command but this one starts it.`);
        return EXIT_UNREACHABLE;
      }
    },
  },
  {
    path: ["server", "stop"],
    summary: "Stop the background server. The next command starts it again",
    ops: [],
    async run({ client, out }) {
      // Waiting agents restart a dead server, which is not what someone stopping it wants.
      writeFileSync(serverStoppedPath(), "");
      try {
        const health = Health.parse(await client.withoutAutoStart().get("/api/health"));
        if (health.pid !== null) process.kill(health.pid, "SIGTERM");
        out.data({ stopped: health.pid }, () => `Stopped pid ${health.pid ?? "?"}.`);
      } catch (error) {
        if (!(error instanceof ConnectionError)) throw error;
        out.data({ stopped: null }, () => "It was not running.");
      }
    },
  },
  {
    path: ["open"],
    summary: "Open the dashboard in the browser",
    ops: [],
    async run({ client, out }) {
      Health.parse(await client.get("/api/health"));
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      Bun.spawn([opener, serverUrl()], { stdout: "ignore", stderr: "ignore" }).unref();
      out.data({ url: serverUrl() }, () => serverUrl());
    },
  },
  {
    path: ["seed", "demo"],
    summary: "Fill an empty tracker with made-up projects, to try the dashboard",
    ops: [],
    async run({ client, out }) {
      const projects = await client.call(c.projectList, {});
      if (projects.data.length > 0) {
        throw new RemoteError({
          code: "conflict",
          message: "This tracker already has projects, so the demo data was not added",
          hint: "Point OCTO_HOME and OCTO_URL at a scratch location to try the demo.",
        });
      }
      const created = await seedDemo(client);
      out.data(
        created,
        () => `Created ${created.decisions} decisions, ${created.issues} issues and ${created.prs} PRs.`,
      );
    },
  },
];
