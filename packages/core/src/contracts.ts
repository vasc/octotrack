import { z } from "zod";
import { isIsoDate } from "./query/match.ts";
import {
  Agent,
  Bootstrap,
  Channel,
  Decision,
  DecisionCard,
  DecisionKind,
  Drift,
  EntityDetail,
  EntitySummary,
  FeedPage,
  Horizon,
  Idea,
  IdeaStatus,
  Issue,
  IssueCard,
  IssueStatus,
  Link,
  LinkRel,
  Milestone,
  MilestoneStatus,
  NextWork,
  PrChecks,
  PrCard,
  PrMergeable,
  PrReview,
  PrState,
  Priority,
  Project,
  ProjectCard,
  ProjectStatus,
  PullRequest,
  Roadmap,
  StatusUpdate,
  UpdateLevel,
  View,
  Watch,
  WatchResult,
  WatchSpec,
} from "./schemas.ts";

/** The typed shape of one operation. Importable from the browser: it holds schemas only, no server code. */
export interface Contract<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  summary: string;
  mutates: boolean;
  input: I;
  output: O;
}

function read<I extends z.ZodType, O extends z.ZodType>(
  name: string,
  summary: string,
  input: I,
  output: O,
): Contract<I, O> {
  return { name, summary, mutates: false, input, output };
}

function write<I extends z.ZodType, O extends z.ZodType>(
  name: string,
  summary: string,
  input: I,
  output: O,
): Contract<I, O> {
  return { name, summary, mutates: true, input, output };
}

const Refs = z.array(z.string()).min(1);
const ListInput = z.strictObject({
  query: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});
const IfVersion = z.number().int().optional();
const Empty = z.strictObject({});
/** Text a person has to read. Spaces alone do not count as saying something. */
const Text = z.string().trim().min(1);
/** A date or a timestamp. Anything unparseable could never be flagged overdue, so it is refused here. */
const DateText = z.string().refine(isIsoDate, { error: "Use a real date, YYYY-MM-DD, or an ISO timestamp" });

const OptionInput = z.strictObject({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const PrInput = z.strictObject({
  repo: z.string().min(1),
  number: z.number().int().positive(),
  title: Text,
  body: z.string().optional(),
  url: z.string().optional(),
  state: PrState,
  checks: PrChecks.optional(),
  review: PrReview.optional(),
  mergeable: PrMergeable.optional(),
  headRef: z.string().optional(),
  baseRef: z.string().optional(),
  headSha: z.string().optional(),
  author: z.string().optional(),
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
  mergedAt: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  issues: z.array(z.string()).optional(),
});
export type PrInput = z.infer<typeof PrInput>;

const ResolveItem = z.strictObject({
  ref: z.string(),
  option: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  decidedAt: DateText.optional(),
  sourceUrl: z.string().optional(),
});

export const ResolveBatchResult = z.object({
  results: z.array(
    z.object({
      ref: z.string(),
      ok: z.boolean(),
      decision: Decision.nullable(),
      error: z.string().nullable(),
    }),
  ),
});

export const LinkGraph = z.object({
  root: z.string(),
  nodes: z.array(EntitySummary),
  edges: z.array(Link),
});

export const DriftAckResult = z.object({ acknowledged: z.array(Drift) });

export const contracts = {
  projectCreate: write(
    "project.create",
    "Create a project",
    z.strictObject({
      key: z.string(),
      name: Text,
      description: z.string().optional(),
      status: ProjectStatus.optional(),
      repo: z.string().optional(),
      horizon: Horizon.optional(),
      targetDate: DateText.optional(),
    }),
    Project,
  ),
  projectUpdate: write(
    "project.update",
    "Update a project",
    z.strictObject({
      ref: z.string(),
      name: Text.optional(),
      description: z.string().optional(),
      status: ProjectStatus.optional(),
      repo: z.string().nullable().optional(),
      horizon: Horizon.optional(),
      targetDate: DateText.nullable().optional(),
      ifVersion: IfVersion,
    }),
    Project,
  ),
  projectList: read("project.list", "List projects with stats", ListInput, z.array(ProjectCard)),

  issueCreate: write(
    "issue.create",
    "Create an issue, optionally wiring its dependencies at the same time",
    z.strictObject({
      project: z.string(),
      title: Text,
      body: z.string().optional(),
      status: IssueStatus.optional(),
      priority: Priority.optional(),
      assignee: z.string().optional(),
      labels: z.array(z.string()).optional(),
      milestone: z.string().optional(),
      blocks: z.array(z.string()).optional(),
      blockedBy: z.array(z.string()).optional(),
      derivedFrom: z.array(z.string()).optional(),
    }),
    Issue,
  ),
  issueUpdate: write(
    "issue.update",
    "Update one or many issues",
    z.strictObject({
      refs: Refs,
      title: Text.optional(),
      body: z.string().optional(),
      status: IssueStatus.optional(),
      priority: Priority.optional(),
      assignee: z.string().nullable().optional(),
      addLabels: z.array(z.string()).optional(),
      removeLabels: z.array(z.string()).optional(),
      milestone: z.string().nullable().optional(),
      ifVersion: IfVersion,
    }),
    z.array(Issue),
  ),
  issueList: read("issue.list", "List issues", ListInput, z.array(IssueCard)),
  issueClaim: write(
    "issue.claim",
    "Claim issues for the calling agent, failing if another agent holds them",
    z.strictObject({ refs: Refs, force: z.boolean().optional() }),
    z.array(Issue),
  ),
  issueRelease: write(
    "issue.release",
    "Release claimed issues",
    z.strictObject({ refs: Refs }),
    z.array(Issue),
  ),

  decisionAsk: write(
    "decision.ask",
    "Ask the developer for a decision",
    z.strictObject({
      title: Text,
      context: z.string().optional(),
      kind: DecisionKind.optional(),
      priority: Priority.optional(),
      project: z.string().optional(),
      options: z.array(OptionInput).optional(),
      recommendation: z.string().optional(),
      dueAt: DateText.optional(),
      blocks: z.array(z.string()).optional(),
      affects: z.array(z.string()).optional(),
    }),
    Decision,
  ),
  decisionUpdate: write(
    "decision.update",
    "Refine an open decision",
    z.strictObject({
      ref: z.string(),
      title: Text.optional(),
      context: z.string().optional(),
      kind: DecisionKind.optional(),
      priority: Priority.optional(),
      project: z.string().nullable().optional(),
      options: z.array(OptionInput).optional(),
      recommendation: z.string().nullable().optional(),
      dueAt: DateText.nullable().optional(),
      ifVersion: IfVersion,
    }),
    Decision,
  ),
  decisionResolve: write(
    "decision.resolve",
    "Record the outcome of a decision",
    z.strictObject({
      ref: z.string(),
      option: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
      channel: Channel.optional(),
      decidedAt: DateText.optional(),
      sourceUrl: z.string().optional(),
      force: z.boolean().optional(),
    }),
    Decision,
  ),
  decisionResolveBatch: write(
    "decision.resolve_batch",
    "Record many outcomes at once, from items or from lines such as `D-3 a Went with postgres`",
    z.strictObject({
      items: z.array(ResolveItem).optional(),
      text: z.string().optional(),
      channel: Channel.optional(),
    }),
    ResolveBatchResult,
  ),
  decisionRecord: write(
    "decision.record",
    "Log a decision that was already made elsewhere",
    z.strictObject({
      title: Text,
      chosen: Text,
      note: z.string().optional(),
      context: z.string().optional(),
      kind: DecisionKind.optional(),
      project: z.string().optional(),
      decidedAt: DateText.optional(),
      sourceUrl: z.string().optional(),
      affects: z.array(z.string()).optional(),
      blocks: z.array(z.string()).optional(),
    }),
    Decision,
  ),
  decisionReopen: write(
    "decision.reopen",
    "Reopen a decision",
    z.strictObject({ ref: z.string(), note: z.string().optional() }),
    Decision,
  ),
  decisionWithdraw: write(
    "decision.withdraw",
    "Withdraw an open decision that is no longer needed",
    z.strictObject({ ref: z.string(), note: z.string().optional() }),
    Decision,
  ),
  decisionSupersede: write(
    "decision.supersede",
    "Mark a decision as replaced by another",
    z.strictObject({ ref: z.string(), by: z.string(), note: z.string().optional() }),
    Decision,
  ),
  decisionList: read("decision.list", "List decisions", ListInput, z.array(Decision)),
  decisionQueue: read(
    "decision.queue",
    "Open decisions, most important first, with the reasons for the ranking",
    ListInput,
    z.array(DecisionCard),
  ),

  prUpsert: write("pr.upsert", "Create or update a pull request", PrInput, PullRequest),
  prSync: write(
    "pr.sync",
    "Report the state of many pull requests at once",
    z.strictObject({
      prs: z.array(PrInput),
      /** Repos this sync reached. Clears any failure recorded for them. */
      repos: z.array(z.string()).optional(),
      /** Repos it could not reach, shown in the dashboard: a silent failure means quietly stale PR status. */
      failures: z.array(z.strictObject({ repo: z.string(), error: z.string() })).optional(),
    }),
    z.object({ synced: z.number().int(), changed: z.array(z.string()) }),
  ),
  prList: read("pr.list", "List pull requests, those needing attention first", ListInput, z.array(PrCard)),

  ideaCapture: write(
    "idea.capture",
    "Capture a future idea",
    z.strictObject({
      title: Text,
      body: z.string().optional(),
      project: z.string().optional(),
      status: IdeaStatus.optional(),
      horizon: Horizon.optional(),
      labels: z.array(z.string()).optional(),
    }),
    Idea,
  ),
  ideaUpdate: write(
    "idea.update",
    "Update an idea",
    z.strictObject({
      ref: z.string(),
      title: Text.optional(),
      body: z.string().optional(),
      project: z.string().nullable().optional(),
      status: IdeaStatus.optional(),
      horizon: Horizon.optional(),
      labels: z.array(z.string()).optional(),
      ifVersion: IfVersion,
    }),
    Idea,
  ),
  ideaPromote: write(
    "idea.promote",
    "Turn an idea into an issue or a milestone",
    z.strictObject({
      ref: z.string(),
      project: z.string().optional(),
      as: z.enum(["issue", "milestone"]).optional(),
      priority: Priority.optional(),
    }),
    z.object({ idea: Idea, created: z.string() }),
  ),
  ideaList: read("idea.list", "List ideas", ListInput, z.array(Idea)),

  milestoneCreate: write(
    "milestone.create",
    "Create a milestone",
    z.strictObject({
      project: z.string(),
      title: Text,
      description: z.string().optional(),
      status: MilestoneStatus.optional(),
      horizon: Horizon.optional(),
      targetDate: DateText.optional(),
    }),
    Milestone,
  ),
  milestoneUpdate: write(
    "milestone.update",
    "Update a milestone",
    z.strictObject({
      ref: z.string(),
      title: Text.optional(),
      description: z.string().optional(),
      status: MilestoneStatus.optional(),
      horizon: Horizon.optional(),
      targetDate: DateText.nullable().optional(),
      ifVersion: IfVersion,
    }),
    Milestone,
  ),
  milestoneList: read("milestone.list", "List milestones", ListInput, z.array(Milestone)),

  linkAdd: write(
    "link.add",
    "Connect two items in the dependency network",
    z.strictObject({ from: z.string(), rel: LinkRel, to: z.string() }),
    Link,
  ),
  linkRemove: write(
    "link.remove",
    "Remove a connection",
    z.strictObject({ from: z.string(), rel: LinkRel, to: z.string() }),
    z.object({ removed: z.boolean() }),
  ),
  linkList: read(
    "link.list",
    "List connections of an item",
    z.strictObject({ ref: z.string() }),
    z.array(Link),
  ),
  linkGraph: read(
    "link.graph",
    "Walk the dependency network around an item",
    z.strictObject({ ref: z.string(), depth: z.number().int().min(1).max(6).optional() }),
    LinkGraph,
  ),

  updatePost: write(
    "update.post",
    "Post a status update to the feed",
    z.strictObject({
      body: Text,
      target: z.string().optional(),
      project: z.string().optional(),
      level: UpdateLevel.optional(),
    }),
    StatusUpdate,
  ),
  updateList: read("update.list", "List status updates", ListInput, z.array(StatusUpdate)),

  driftList: read(
    "drift.list",
    "List drift; open drift only unless the query says otherwise",
    ListInput,
    z.array(Drift),
  ),
  driftAck: write(
    "drift.ack",
    "Clear drift: either you updated the target, or you checked and nothing needs updating",
    z.strictObject({
      refs: z.array(z.string()).optional(),
      target: z.string().optional(),
      mode: z.enum(["updated", "verified"]),
      note: Text,
      force: z.boolean().optional(),
    }),
    DriftAckResult,
  ),
  driftClaim: write(
    "drift.claim",
    "Take drift for the calling agent, so that other agents leave it alone",
    z.strictObject({ refs: Refs, force: z.boolean().optional() }),
    z.array(Drift),
  ),
  driftScan: write(
    "drift.scan",
    "Re-evaluate every drift rule now, including the time-based ones",
    Empty,
    z.object({ open: z.number().int() }),
  ),

  feedList: read(
    "feed.list",
    "Read the feed, newest first",
    z.strictObject({
      query: z.string().optional(),
      view: z.string().optional(),
      before: z.number().int().optional(),
      after: z.number().int().optional(),
      limit: z.number().int().positive().max(500).optional(),
    }),
    FeedPage,
  ),

  viewSave: write(
    "view.save",
    "Save a named filter",
    z.strictObject({ name: z.string().min(1), query: z.string() }),
    View,
  ),
  viewList: read("view.list", "List saved filters", Empty, z.array(View)),
  viewRemove: write(
    "view.remove",
    "Remove a saved filter",
    z.strictObject({ name: z.string() }),
    z.object({ removed: z.boolean() }),
  ),

  watchCreate: write(
    "watch.create",
    "Register a watch",
    z.strictObject({
      spec: WatchSpec,
      name: z.string().optional(),
      since: z.number().int().optional(),
      follow: z.boolean().optional(),
      ephemeral: z.boolean().optional(),
    }),
    Watch,
  ),
  watchCheck: write(
    "watch.check",
    "Evaluate watches once without waiting. Also counts as a heartbeat",
    z.strictObject({ refs: Refs }),
    z.array(WatchResult),
  ),
  watchList: read(
    "watch.list",
    "List watches",
    z.strictObject({ all: z.boolean().optional(), agent: z.string().optional() }),
    z.array(Watch),
  ),
  watchCancel: write(
    "watch.cancel",
    "Cancel watches",
    z.strictObject({ refs: Refs }),
    z.object({ cancelled: z.array(z.string()) }),
  ),

  agentList: read("agent.list", "List agents seen by the tracker", Empty, z.array(Agent)),
  agentNote: write(
    "agent.note",
    "Say what the calling agent is working on",
    z.strictObject({ note: z.string().nullable() }),
    Agent,
  ),

  roadmapGenerate: read(
    "roadmap.generate",
    "Generate a now/next/later roadmap from milestones, projects and ideas",
    z.strictObject({ project: z.string().optional() }),
    Roadmap,
  ),
  next: read(
    "next",
    "What the calling agent should do next: drift, decisions, claimed work, PRs, ready issues",
    z.strictObject({
      agent: z.string().optional(),
      project: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    NextWork,
  ),
  entityShow: read(
    "entity.show",
    "Show any item by ref, with links, drift and history",
    z.strictObject({ ref: z.string() }),
    EntityDetail,
  ),
  entityFind: read(
    "entity.find",
    "Search current state across every kind of item",
    ListInput,
    z.array(EntitySummary),
  ),

  dashboardBootstrap: read(
    "dashboard.bootstrap",
    "Everything the dashboard needs for first paint",
    z.strictObject({ view: z.string().optional(), query: z.string().optional() }),
    Bootstrap,
  ),
  systemFields: read(
    "system.fields",
    "Describe the query language fields",
    Empty,
    z.array(z.object({ name: z.string(), description: z.string() })),
  ),
};

export const ErrorBody = z.object({
  code: z.string(),
  message: z.string(),
  hint: z.string().nullable(),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

/** Every op response. `driftOpened` tells a writer immediately what its change just put out of date. */
export const OpEnvelope = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: z.unknown(), driftOpened: z.array(Drift), cursor: z.number().int() }),
  z.object({ ok: z.literal(false), error: ErrorBody }),
]);
export type OpEnvelope = z.infer<typeof OpEnvelope>;

export const BatchOp = z.strictObject({
  op: z.string(),
  input: z.unknown().optional(),
  /** Later ops can use `$alias.field` in their input to refer to this op's output. */
  as: z.string().optional(),
});
export type BatchOp = z.infer<typeof BatchOp>;

export const BatchRequest = z.strictObject({
  ops: z.array(BatchOp).min(1),
  /** All-or-nothing by default. With false, each op stands alone and failures are reported per op. */
  atomic: z.boolean().optional(),
});
export type BatchRequest = z.infer<typeof BatchRequest>;

export const BatchResult = z.object({
  ok: z.boolean(),
  results: z.array(
    z.object({
      op: z.string(),
      ok: z.boolean(),
      data: z.unknown(),
      error: ErrorBody.nullable(),
    }),
  ),
  driftOpened: z.array(Drift),
  cursor: z.number().int(),
});
export type BatchResult = z.infer<typeof BatchResult>;

export const WatchWaitRequest = z.strictObject({
  refs: Refs,
  /** Server-side hold in milliseconds. Long polls are capped; clients simply poll again. */
  holdMs: z.number().int().min(0).max(25_000).optional(),
});
export type WatchWaitRequest = z.infer<typeof WatchWaitRequest>;

export const WatchWaitResponse = z.object({
  fired: z.boolean(),
  results: z.array(WatchResult),
  cursor: z.number().int(),
});
export type WatchWaitResponse = z.infer<typeof WatchWaitResponse>;
