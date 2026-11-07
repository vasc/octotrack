import { contracts as c } from "@octotrack/core";
import { UsageError } from "../args.ts";
import type { Command } from "../command.ts";
import * as r from "../render.ts";
import { compact, LIST_OPTIONS, listInput, textOption } from "./shared.ts";

const STRING = { type: "string" } as const;
const MANY = { type: "string", multiple: true } as const;

const projectFields = {
  desc: { ...STRING, description: "Description" },
  status: { ...STRING, description: "planned, active, paused, done, archived" },
  repo: { ...STRING, description: "GitHub repo, owner/name. PRs from it are tracked automatically" },
  horizon: { ...STRING, description: "now, next, later, none" },
  "target-date": { ...STRING, description: "Target date, YYYY-MM-DD" },
};

const milestoneFields = {
  desc: { ...STRING, description: "Description" },
  status: { ...STRING, description: "planned, active, done, cancelled" },
  horizon: { ...STRING, description: "now, next, later, none. Otherwise derived from status and date" },
  "target-date": { ...STRING, description: "Target date, YYYY-MM-DD" },
};

const ideaFields = {
  body: { ...STRING, description: "Details" },
  "body-file": { ...STRING, description: "Read details from a file, - for stdin" },
  project: { ...STRING, short: "p", description: "Project key" },
  status: { ...STRING, description: "captured, exploring, planned, promoted, rejected" },
  horizon: { ...STRING, description: "now, next, later, none. Anything but none puts it on the roadmap" },
};

export const workCommands: Command[] = [
  {
    path: ["project", "create"],
    usage: "<KEY> <name>",
    summary: "Create a project",
    options: projectFields,
    examples: ['octo project create OCT "Octotrack" --repo acme/octotrack'],
    ops: [c.projectCreate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.projectCreate,
        compact({
          key: args.requirePositional(0, "KEY"),
          name: args.requirePositional(1, "name"),
          description: args.str("desc"),
          status: args.str("status"),
          repo: args.str("repo"),
          horizon: args.str("horizon"),
          targetDate: args.str("target-date"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.name}`);
    },
  },
  {
    path: ["project", "list"],
    usage: "[QUERY]",
    summary: "List projects with progress",
    options: { ...LIST_OPTIONS, status: { ...MANY, description: "Filter by status" } },
    ops: [c.projectList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.projectList, listInput(args, ["status"]));
      out.result(outcome, () => r.renderProjects(outcome.data));
    },
  },
  {
    path: ["project", "update"],
    usage: "<KEY>",
    summary: "Update a project",
    options: {
      ...projectFields,
      name: { ...STRING, description: "New name" },
      "no-repo": { type: "boolean", description: "Remove the repo" },
      "if-version": { ...STRING, description: "Only if still at this version" },
    },
    ops: [c.projectUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.projectUpdate,
        compact({
          ref: args.requirePositional(0, "KEY"),
          name: args.str("name"),
          description: args.str("desc"),
          status: args.str("status"),
          repo: args.flag("no-repo") ? null : args.str("repo"),
          horizon: args.str("horizon"),
          targetDate: args.str("target-date"),
          ifVersion: args.int("if-version"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} updated (${outcome.data.status})`);
    },
  },
  {
    path: ["issue", "create"],
    usage: "<title>",
    summary: "Create an issue",
    options: {
      project: { ...STRING, short: "p", description: "Project key (required)" },
      body: { ...STRING, short: "b", description: "Details" },
      "body-file": { ...STRING, description: "Read details from a file, - for stdin" },
      status: { ...STRING, description: "backlog, todo, in_progress, in_review, blocked, done, cancelled" },
      priority: { ...STRING, description: "urgent, high, medium, low, none" },
      assignee: { ...STRING, description: "Agent" },
      label: { ...MANY, short: "l", description: "Label, repeatable" },
      milestone: { ...STRING, short: "m", description: "Milestone ref" },
      blocks: { ...MANY, description: "This issue blocks that item, repeatable" },
      "blocked-by": { ...MANY, description: "That item blocks this issue, repeatable" },
      "derived-from": { ...MANY, description: "Flag this issue when that item changes, repeatable" },
    },
    examples: ['octo issue create "Add retry" -p OCT --priority high --blocked-by D-3'],
    ops: [c.issueCreate.name],
    async run({ client, out }, args) {
      const project = args.str("project");
      if (project === undefined) throw new UsageError("Missing --project");
      const outcome = await client.call(
        c.issueCreate,
        compact({
          project,
          title: args.requirePositional(0, "title"),
          body: await textOption(args, "body"),
          status: args.str("status"),
          priority: args.str("priority"),
          assignee: args.str("assignee"),
          labels: args.optionalList("label"),
          milestone: args.str("milestone"),
          blocks: args.optionalList("blocks"),
          blockedBy: args.optionalList("blocked-by"),
          derivedFrom: args.optionalList("derived-from"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
  {
    path: ["issue", "list"],
    usage: "[QUERY]",
    summary: "List issues",
    options: {
      ...LIST_OPTIONS,
      project: { ...MANY, short: "p", description: "Filter by project" },
      status: { ...MANY, description: "Filter by status" },
      assignee: { ...MANY, description: "Filter by assignee, none for unassigned" },
      label: { ...MANY, short: "l", description: "Filter by label" },
      priority: { ...MANY, description: "Filter by priority" },
    },
    examples: [
      "octo issue list ready:true -p OCT",
      'octo issue list "status:todo,in_progress -assignee:none"',
    ],
    ops: [c.issueList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.issueList,
        listInput(args, ["project", "status", "assignee", "label", "priority"]),
      );
      out.result(outcome, () => r.renderIssues(outcome.data));
    },
  },
  {
    path: ["issue", "update"],
    usage: "<REF...>",
    summary: "Update one or many issues",
    options: {
      title: { ...STRING, description: "New title" },
      body: { ...STRING, short: "b", description: "New details" },
      "body-file": { ...STRING, description: "Read details from a file, - for stdin" },
      status: { ...STRING, description: "backlog, todo, in_progress, in_review, blocked, done, cancelled" },
      priority: { ...STRING, description: "urgent, high, medium, low, none" },
      assignee: { ...STRING, description: "Agent" },
      unassign: { type: "boolean", description: "Remove the assignee" },
      "add-label": { ...MANY, description: "Add a label, repeatable" },
      "remove-label": { ...MANY, description: "Remove a label, repeatable" },
      milestone: { ...STRING, short: "m", description: "Milestone ref" },
      "no-milestone": { type: "boolean", description: "Remove from its milestone" },
      "if-version": { ...STRING, description: "Only if still at this version (single ref)" },
    },
    examples: ["octo issue update OCT-1 OCT-2 OCT-3 --status done"],
    ops: [c.issueUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.issueUpdate,
        compact({
          refs: args.requirePositionals("REF"),
          title: args.str("title"),
          body: await textOption(args, "body"),
          status: args.str("status"),
          priority: args.str("priority"),
          assignee: args.flag("unassign") ? null : args.str("assignee"),
          addLabels: args.optionalList("add-label"),
          removeLabels: args.optionalList("remove-label"),
          milestone: args.flag("no-milestone") ? null : args.str("milestone"),
          ifVersion: args.int("if-version"),
        }),
      );
      out.result(outcome, () => r.renderIssueLines(outcome.data));
    },
  },
  {
    path: ["issue", "close"],
    usage: "<REF...>",
    summary: "Mark issues done",
    options: { cancel: { type: "boolean", description: "Cancelled rather than done" } },
    ops: [c.issueUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.issueUpdate, {
        refs: args.requirePositionals("REF"),
        status: args.flag("cancel") ? "cancelled" : "done",
      });
      out.result(outcome, () => r.renderIssueLines(outcome.data));
    },
  },
  {
    path: ["issue", "claim"],
    usage: "<REF...>",
    summary: "Claim issues for this agent; moves them to in_progress",
    options: { force: { type: "boolean", description: "Take over from another agent" } },
    ops: [c.issueClaim.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.issueClaim,
        compact({ refs: args.requirePositionals("REF"), force: args.flag("force") || undefined }),
      );
      out.result(outcome, () => r.renderIssueLines(outcome.data));
    },
  },
  {
    path: ["issue", "release"],
    usage: "<REF...>",
    summary: "Give up claimed issues",
    ops: [c.issueRelease.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.issueRelease, { refs: args.requirePositionals("REF") });
      out.result(outcome, () => r.renderIssueLines(outcome.data));
    },
  },
  {
    path: ["milestone", "create"],
    usage: "<title>",
    summary: "Create a milestone",
    options: {
      ...milestoneFields,
      project: { ...STRING, short: "p", description: "Project key (required)" },
    },
    examples: ['octo milestone create "Public beta" -p OCT --status active --target-date 2026-12-01'],
    ops: [c.milestoneCreate.name],
    async run({ client, out }, args) {
      const project = args.str("project");
      if (project === undefined) throw new UsageError("Missing --project");
      const outcome = await client.call(
        c.milestoneCreate,
        compact({
          project,
          title: args.requirePositional(0, "title"),
          description: args.str("desc"),
          status: args.str("status"),
          horizon: args.str("horizon"),
          targetDate: args.str("target-date"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
  {
    path: ["milestone", "list"],
    usage: "[QUERY]",
    summary: "List milestones",
    options: { ...LIST_OPTIONS, project: { ...MANY, short: "p", description: "Filter by project" } },
    ops: [c.milestoneList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.milestoneList, listInput(args, ["project"]));
      out.result(outcome, () => r.renderMilestones(outcome.data));
    },
  },
  {
    path: ["milestone", "update"],
    usage: "<REF>",
    summary: "Update a milestone",
    options: {
      ...milestoneFields,
      title: { ...STRING, description: "New title" },
      "no-target-date": { type: "boolean", description: "Remove the target date" },
      "if-version": { ...STRING, description: "Only if still at this version" },
    },
    ops: [c.milestoneUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.milestoneUpdate,
        compact({
          ref: args.requirePositional(0, "REF"),
          title: args.str("title"),
          description: args.str("desc"),
          status: args.str("status"),
          horizon: args.str("horizon"),
          targetDate: args.flag("no-target-date") ? null : args.str("target-date"),
          ifVersion: args.int("if-version"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.status}`);
    },
  },
  {
    path: ["idea", "add"],
    usage: "<title>",
    summary: "Capture a future idea",
    options: { ...ideaFields, label: { ...MANY, short: "l", description: "Label, repeatable" } },
    examples: ['octo idea add "Slack digest of open decisions" -p OCT --horizon later'],
    ops: [c.ideaCapture.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.ideaCapture,
        compact({
          title: args.requirePositional(0, "title"),
          body: await textOption(args, "body"),
          project: args.str("project"),
          status: args.str("status"),
          horizon: args.str("horizon"),
          labels: args.optionalList("label"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.title}`);
    },
  },
  {
    path: ["idea", "list"],
    usage: "[QUERY]",
    summary: "List ideas",
    options: {
      ...LIST_OPTIONS,
      project: { ...MANY, short: "p", description: "Filter by project" },
      status: { ...MANY, description: "Filter by status" },
    },
    ops: [c.ideaList.name],
    async run({ client, out }, args) {
      const outcome = await client.call(c.ideaList, listInput(args, ["project", "status"]));
      out.result(outcome, () => r.renderIdeas(outcome.data));
    },
  },
  {
    path: ["idea", "update"],
    usage: "<REF>",
    summary: "Update an idea",
    options: {
      ...ideaFields,
      title: { ...STRING, description: "New title" },
      label: { ...MANY, short: "l", description: "Replace labels, repeatable" },
      "no-project": { type: "boolean", description: "Detach from its project" },
      "if-version": { ...STRING, description: "Only if still at this version" },
    },
    ops: [c.ideaUpdate.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.ideaUpdate,
        compact({
          ref: args.requirePositional(0, "REF"),
          title: args.str("title"),
          body: await textOption(args, "body"),
          project: args.flag("no-project") ? null : args.str("project"),
          status: args.str("status"),
          horizon: args.str("horizon"),
          labels: args.optionalList("label"),
          ifVersion: args.int("if-version"),
        }),
      );
      out.result(outcome, () => `${r.bold(outcome.data.ref)} ${outcome.data.status}`);
    },
  },
  {
    path: ["idea", "promote"],
    usage: "<REF>",
    summary: "Turn an idea into an issue or milestone",
    options: {
      project: { ...STRING, short: "p", description: "Project key, if the idea has none" },
      as: { ...STRING, description: "issue (default) or milestone" },
      priority: { ...STRING, description: "Priority of the new issue" },
    },
    ops: [c.ideaPromote.name],
    async run({ client, out }, args) {
      const outcome = await client.call(
        c.ideaPromote,
        compact({
          ref: args.requirePositional(0, "REF"),
          project: args.str("project"),
          as: args.str("as"),
          priority: args.str("priority"),
        }),
      );
      out.result(outcome, () => `${outcome.data.idea.ref} promoted to ${r.bold(outcome.data.created)}`);
    },
  },
];
