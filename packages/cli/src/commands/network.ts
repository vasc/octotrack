import { contracts as c, parseRepoPrRef } from "@octotrack/core";
import { fetchRepoPrs } from "@octotrack/server/gh";
import { UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact, LIST_OPTIONS, listInput } from "./shared.ts";

const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

/** Friendlier names for the relation, some of which read in the opposite direction. */
export function normalizeRelation(
  from: string,
  rel: string,
  to: string,
): { from: string; rel: string; to: string } {
  const name = rel.replaceAll("-", "_").toLowerCase();
  if (name === "blocked_by" || name === "depends_on") return { from: to, rel: "blocks", to: from };
  if (name === "implemented_by") return { from: to, rel: "implements", to: from };
  return { from, rel: name, to };
}

function linkArgs(positionals: readonly string[]) {
  const [from, rel, to] = positionals;
  if (from === undefined || rel === undefined || to === undefined)
    throw new UsageError("Expected <from> <relation> <to>");
  return normalizeRelation(from, rel, to);
}

export const networkCommands: Command[] = [
  {
    path: ["pr", "upsert"],
    usage: "<owner/repo#number> <title>",
    summary: "Create or update a pull request by hand",
    options: {
      state: { ...STRING, description: "open (default), draft, merged, closed" },
      checks: { ...STRING, description: "none, pending, passing, failing" },
      review: { ...STRING, description: "none, requested, approved, changes_requested" },
      mergeable: { ...STRING, description: "unknown, clean, conflicting" },
      body: { ...STRING, short: "b", description: "Description" },
      url: { ...STRING, description: "Link" },
      head: { ...STRING, description: "Head branch" },
      base: { ...STRING, description: "Base branch" },
      sha: { ...STRING, description: "Head commit" },
      author: { ...STRING, description: "Author" },
      issue: { ...MANY, short: "i", description: "Issue it implements, repeatable" },
    },
    examples: ['octo pr upsert acme/app#12 "Add retry" --checks passing -i OCT-4'],
    ops: [c.prUpsert.name],
    async run({ client, out }, args) {
      const spec = args.requirePositional(0, "owner/repo#number");
      const parsed = parseRepoPrRef(spec);
      if (parsed === null) throw new UsageError(`Expected owner/repo#number, got "${spec}"`);
      const outcome = await client.call(
        c.prUpsert,
        compact({
          repo: parsed.repo,
          number: parsed.number,
          title: args.requirePositional(1, "title"),
          state: args.str("state") ?? "open",
          checks: args.str("checks"),
          review: args.str("review"),
          mergeable: args.str("mergeable"),
          body: args.str("body"),
          url: args.str("url"),
          headRef: args.str("head"),
          baseRef: args.str("base"),
          headSha: args.str("sha"),
          author: args.str("author"),
          issues: args.optionalList("issue"),
        }),
      );
      out.result(outcome, () => r.renderPr(outcome.data));
    },
  },
  {
    path: ["pr", "sync"],
    summary: "Pull PR status from GitHub with gh, for one repo or every project with a repo",
    options: { repo: { ...MANY, description: "owner/name, repeatable. Default: all project repos" } },
    ops: [c.prSync.name],
    async run({ client, out }, args) {
      let repos = args.list("repo");
      if (repos.length === 0) {
        const projects = await client.call(c.projectList, {});
        repos = [
          ...new Set(
            projects.data.flatMap((card) => (card.project.repo === null ? [] : [card.project.repo])),
          ),
        ];
      }
      if (repos.length === 0)
        throw new UsageError("No repo to sync. Set one with: octo project update <KEY> --repo owner/name");
      // One unreachable repo must not stop the others from updating.
      const fetched = await Promise.all(
        repos.map(async (repo) => {
          try {
            const tracked = await client.call(c.prList, {
              query: `repo:${repo} state:open,draft`,
              limit: 1000,
            });
            const result = await fetchRepoPrs(
              repo,
              tracked.data.map((card) => card.pr.number),
            );
            return { repo, ...result, error: null };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { repo, prs: [], warnings: [], error: message };
          }
        }),
      );
      const failures = fetched.flatMap(({ repo, error }) => (error === null ? [] : [{ repo, error }]));
      const outcome = await client.call(c.prSync, {
        prs: fetched.flatMap((result) => result.prs),
        repos: fetched.filter((result) => result.error === null).map((result) => result.repo),
        failures: [
          ...failures,
          ...fetched.flatMap(({ repo, warnings }) =>
            warnings.length === 0 ? [] : [{ repo, error: warnings.join("; ") }],
          ),
        ],
      });
      const errors = [
        ...failures.map((failure) => failure.error),
        ...fetched.flatMap((result) => result.warnings),
      ];
      const data = { ...outcome.data, errors };
      out.result(
        { ...outcome, data },
        () =>
          [
            `Synced ${data.synced} PRs from ${repos.length - failures.length} of ${repos.length} repos, ${data.changed.length} changed.`,
            ...errors.map((error) => r.red(error)),
          ].join("\n"),
        errors.length === 0,
      );
      return errors.length === 0 ? 0 : 1;
    },
  },
  {
    path: ["pr", "list"],
    usage: "[QUERY]",
    summary: "List pull requests, those needing attention first",
    options: {
      ...LIST_OPTIONS,
      state: { ...MANY, description: "Filter by state" },
      checks: { ...MANY, description: "Filter by checks" },
      review: { ...MANY, description: "Filter by review" },
      repo: { ...MANY, description: "Filter by repo" },
      project: { ...MANY, short: "p", description: "Filter by project" },
    },
    examples: ["octo pr list --state open --checks failing"],
    ops: [c.prList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.prList,
        listInput(args, ["state", "checks", "review", "repo", "project"]),
      );
      out.result(outcome, () => r.renderPrs(outcome.data));
    },
  },
  {
    path: ["pr", "link"],
    usage: "<PR> <ISSUE...>",
    summary: "Say that a pull request implements these issues",
    ops: [c.linkAdd.name],
    async run({ client, out }, args) {
      const pr = args.requirePositional(0, "PR");
      const issues = args.positionals.slice(1);
      if (issues.length === 0) throw new UsageError("Missing <ISSUE>");
      const result = await client.batch({
        ops: issues.map((issue) => ({
          op: c.linkAdd.name,
          input: { from: pr, rel: "implements", to: issue },
        })),
      });
      out.line(result, () =>
        result.ok
          ? `${pr} implements ${issues.join(", ")}`
          : (result.results.find((item) => item.error?.code !== "rolled_back")?.error?.message ?? "Failed"),
      );
      return result.ok ? 0 : 1;
    },
  },
  {
    path: ["link", "add"],
    usage: "<from> <relation> <to>",
    summary:
      "Connect two items: blocks, blocked-by, depends-on, implements, affects, derived-from, supersedes, relates",
    examples: [
      "octo link add D-3 blocks OCT-4",
      "octo link add OCT-9 derived-from D-3   # flag OCT-9 whenever D-3 changes",
    ],
    ops: [c.linkAdd.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.linkAdd, linkArgs(args.positionals));
      out.result(outcome, () => `${outcome.data.fromRef} ${outcome.data.rel} ${outcome.data.toRef}`);
    },
  },
  {
    path: ["link", "rm"],
    usage: "<from> <relation> <to>",
    summary: "Remove a connection",
    ops: [c.linkRemove.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.linkRemove, linkArgs(args.positionals));
      out.result(outcome, () => (outcome.data.removed ? "Removed." : "No such link."));
    },
  },
  {
    path: ["link", "list"],
    usage: "<REF>",
    summary: "List the connections of an item",
    ops: [c.linkList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.linkList, { ref: args.requirePositional(0, "REF") });
      out.result(outcome, () => r.renderLinks(outcome.data));
    },
  },
  {
    path: ["link", "graph"],
    usage: "<REF>",
    summary: "Walk the dependency network around an item",
    options: { depth: { ...STRING, description: "How many hops, 1 to 6. Default 3" } },
    ops: [c.linkGraph.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.linkGraph,
        compact({ ref: args.requirePositional(0, "REF"), depth: args.int("depth") }),
      );
      out.result(
        outcome,
        () => `${r.renderSummaries(outcome.data.nodes)}\n\n${r.renderLinks(outcome.data.edges)}`,
      );
    },
  },
  {
    path: ["post"],
    usage: "<text>",
    summary: "Post a status update to the feed, optionally about an item",
    options: {
      on: { ...STRING, description: "The item it is about" },
      project: { ...STRING, short: "p", description: "Project key" },
      level: { ...STRING, description: "info, progress, warning, blocker, done" },
    },
    examples: ['octo post "Retry works, adding tests" --on OCT-4 --level progress'],
    ops: [c.updatePost.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.updatePost,
        compact({
          body: args.requirePositional(0, "text"),
          target: args.str("on"),
          project: args.str("project"),
          level: args.str("level"),
        }),
      );
      out.result(outcome, () => r.renderUpdate(outcome.data));
    },
  },
  {
    path: ["updates"],
    usage: "[QUERY]",
    summary: "List status updates",
    options: LIST_OPTIONS,
    ops: [c.updateList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.updateList, listInput(args));
      out.result(outcome, () => r.renderUpdates(outcome.data));
    },
  },
  {
    path: ["drift", "list"],
    usage: "[QUERY]",
    summary: "What is out of date and needs an update or a check. Open only, unless the query names a status",
    options: {
      ...LIST_OPTIONS,
      project: { ...MANY, short: "p", description: "Filter by project" },
      assignee: { ...MANY, description: "Filter by agent; none for unassigned" },
      rule: { ...MANY, description: "Filter by rule" },
    },
    examples: ["octo drift list -p OCT", "octo drift list status:verified"],
    ops: [c.driftList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.driftList, listInput(args, ["project", "assignee", "rule"]));
      out.result(outcome, () => r.renderDriftList(outcome.data));
    },
  },
  {
    path: ["drift", "ack"],
    usage: "[DR-1 DR-2...]",
    summary: "Clear drift: --updated if you changed it, --verified if you checked and nothing needs changing",
    options: {
      target: { ...STRING, description: "All open drift on this item, instead of naming drift refs" },
      force: { type: "boolean", description: "Clear drift that another agent has claimed" },
      updated: { ...STRING, description: "What you changed" },
      verified: { ...STRING, description: "Why nothing needs changing" },
    },
    examples: [
      'octo drift ack DR-4 --verified "Project description does not mention the queue"',
      'octo drift ack --target OCT-4 --updated "Body now says redis"',
    ],
    ops: [c.driftAck.name],
    async run({ client, out }, args) {
      const updated = args.str("updated");
      const verified = args.str("verified");
      if ((updated === undefined) === (verified === undefined)) {
        throw new UsageError(
          'Pass exactly one of --updated "what changed" or --verified "why nothing needs changing"',
        );
      }
      const refs = args.positionals.length > 0 ? [...args.positionals] : undefined;
      const outcome = await client.call(
        c.driftAck,
        compact({
          refs,
          target: args.str("target"),
          mode: updated === undefined ? "verified" : "updated",
          note: updated ?? verified,
          force: args.flag("force") || undefined,
        }),
      );
      out.result(outcome, () => `Cleared ${outcome.data.acknowledged.length} drift.`);
    },
  },
  {
    path: ["drift", "claim"],
    usage: "<DR-1 DR-2...>",
    summary: "Take drift for this agent, so that other agents leave it alone",
    options: { force: { type: "boolean", description: "Take it over from another agent" } },
    ops: [c.driftClaim.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.driftClaim,
        compact({ refs: args.requirePositionals("DR"), force: args.flag("force") || undefined }),
      );
      out.result(outcome, () => `Claimed ${outcome.data.map((drift) => drift.ref).join(", ")}.`);
    },
  },
  {
    path: ["drift", "scan"],
    summary: "Re-evaluate every rule now, including the time-based ones",
    ops: [c.driftScan.name],
    async run({ client, out }) {
      const outcome = await client.call(c.driftScan, {});
      out.result(outcome, () => `${outcome.data.open} open drift.`);
    },
  },
];
