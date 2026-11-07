import { z } from "zod";

export const ProjectStatus = z.enum(["planned", "active", "paused", "done", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const IssueStatus = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
]);
export type IssueStatus = z.infer<typeof IssueStatus>;

export const Priority = z.enum(["urgent", "high", "medium", "low", "none"]);
export type Priority = z.infer<typeof Priority>;

export const DecisionKind = z.enum(["technical", "architecture", "product", "approval"]);
export type DecisionKind = z.infer<typeof DecisionKind>;

export const DecisionStatus = z.enum(["open", "decided", "withdrawn", "superseded"]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

export const Channel = z.enum(["dashboard", "cli", "out_of_band"]);
export type Channel = z.infer<typeof Channel>;

export const PrState = z.enum(["open", "draft", "merged", "closed"]);
export type PrState = z.infer<typeof PrState>;

export const PrChecks = z.enum(["none", "pending", "passing", "failing"]);
export type PrChecks = z.infer<typeof PrChecks>;

export const PrReview = z.enum(["none", "requested", "approved", "changes_requested"]);
export type PrReview = z.infer<typeof PrReview>;

export const PrMergeable = z.enum(["unknown", "clean", "conflicting"]);
export type PrMergeable = z.infer<typeof PrMergeable>;

export const IdeaStatus = z.enum(["captured", "exploring", "planned", "promoted", "rejected"]);
export type IdeaStatus = z.infer<typeof IdeaStatus>;

export const MilestoneStatus = z.enum(["planned", "active", "done", "cancelled"]);
export type MilestoneStatus = z.infer<typeof MilestoneStatus>;

export const Horizon = z.enum(["now", "next", "later", "none"]);
export type Horizon = z.infer<typeof Horizon>;

export const UpdateLevel = z.enum(["info", "progress", "warning", "blocker", "done"]);
export type UpdateLevel = z.infer<typeof UpdateLevel>;

export const DriftStatus = z.enum(["open", "updated", "verified", "auto_resolved"]);
export type DriftStatus = z.infer<typeof DriftStatus>;

export const LinkRel = z.enum([
  "blocks",
  "implements",
  "affects",
  "derived_from",
  "supersedes",
  "promoted_to",
  "relates",
]);
export type LinkRel = z.infer<typeof LinkRel>;

export const EntityKind = z.enum([
  "project",
  "issue",
  "decision",
  "pr",
  "milestone",
  "idea",
  "update",
  "drift",
]);
export type EntityKind = z.infer<typeof EntityKind>;

export const WatchStatus = z.enum(["active", "fired", "cancelled", "expired"]);
export type WatchStatus = z.infer<typeof WatchStatus>;

export const Project = z.object({
  ref: z.string(),
  name: z.string(),
  description: z.string(),
  status: ProjectStatus,
  repo: z.string().nullable(),
  horizon: Horizon,
  targetDate: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
export type Project = z.infer<typeof Project>;

export const Issue = z.object({
  ref: z.string(),
  project: z.string(),
  title: z.string(),
  body: z.string(),
  status: IssueStatus,
  priority: Priority,
  assignee: z.string().nullable(),
  labels: z.array(z.string()),
  milestone: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  createdBy: z.string(),
});
export type Issue = z.infer<typeof Issue>;

export const DecisionOption = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
});
export type DecisionOption = z.infer<typeof DecisionOption>;

export const Decision = z.object({
  ref: z.string(),
  project: z.string().nullable(),
  kind: DecisionKind,
  title: z.string(),
  context: z.string(),
  options: z.array(DecisionOption),
  recommendation: z.string().nullable(),
  status: DecisionStatus,
  priority: Priority,
  requestedBy: z.string(),
  dueAt: z.string().nullable(),
  /** Pushed to the bottom of the queue by someone not ready to answer. Still open. */
  postponedAt: z.string().nullable(),
  chosenOption: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  channel: Channel.nullable(),
  sourceUrl: z.string().nullable(),
  supersededBy: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Decision = z.infer<typeof Decision>;

export const PullRequest = z.object({
  ref: z.string(),
  repo: z.string(),
  number: z.number().int(),
  project: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  state: PrState,
  checks: PrChecks,
  review: PrReview,
  mergeable: PrMergeable,
  headRef: z.string(),
  baseRef: z.string(),
  headSha: z.string(),
  author: z.string(),
  additions: z.number().int(),
  deletions: z.number().int(),
  mergedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  syncedAt: z.string().nullable(),
});
export type PullRequest = z.infer<typeof PullRequest>;

export const Milestone = z.object({
  ref: z.string(),
  project: z.string(),
  title: z.string(),
  description: z.string(),
  status: MilestoneStatus,
  horizon: Horizon,
  targetDate: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
export type Milestone = z.infer<typeof Milestone>;

export const Idea = z.object({
  ref: z.string(),
  project: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  status: IdeaStatus,
  horizon: Horizon,
  labels: z.array(z.string()),
  promotedTo: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
export type Idea = z.infer<typeof Idea>;

export const StatusUpdate = z.object({
  ref: z.string(),
  target: z.string().nullable(),
  project: z.string().nullable(),
  level: UpdateLevel,
  body: z.string(),
  actor: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StatusUpdate = z.infer<typeof StatusUpdate>;

export const Link = z.object({
  fromRef: z.string(),
  rel: LinkRel,
  toRef: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});
export type Link = z.infer<typeof Link>;

export const FieldChange = z.object({ from: z.unknown(), to: z.unknown() });
export type FieldChange = z.infer<typeof FieldChange>;

/** Attributes copied onto an event so that it stays queryable after the entity changes. */
export const EventAttrs = z.record(z.string(), z.union([z.string(), z.array(z.string())]));
export type EventAttrs = z.infer<typeof EventAttrs>;

export const FeedEvent = z.object({
  seq: z.number().int(),
  ts: z.string(),
  actor: z.string(),
  type: z.string(),
  kind: EntityKind,
  ref: z.string(),
  project: z.string().nullable(),
  summary: z.string(),
  related: z.array(z.string()),
  attrs: EventAttrs,
  changes: z.record(z.string(), FieldChange),
});
export type FeedEvent = z.infer<typeof FeedEvent>;

export const Drift = z.object({
  ref: z.string(),
  rule: z.string(),
  dedupeKey: z.string(),
  fingerprint: z.string(),
  edge: z.boolean(),
  target: z.string(),
  cause: z.string().nullable(),
  viaLink: z.boolean(),
  project: z.string().nullable(),
  message: z.string(),
  suggestion: z.string(),
  status: DriftStatus,
  /** Who it is routed to, by default whoever holds the target. Only a suggestion: `claimedBy` is the commitment. */
  assignee: z.string().nullable(),
  claimedBy: z.string().nullable(),
  /** When what it reports last changed. An update only counts if it came after this. */
  baselineAt: z.string(),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  note: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Drift = z.infer<typeof Drift>;

export const View = z.object({
  name: z.string(),
  query: z.string(),
  position: z.number().int(),
  builtin: z.boolean(),
  createdAt: z.string(),
});
export type View = z.infer<typeof View>;

export const Agent = z.object({
  name: z.string(),
  note: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type Agent = z.infer<typeof Agent>;

export const WatchClause = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("event"),
    query: z.string(),
    count: z.number().int().positive().default(1),
  }),
  z.strictObject({
    type: z.literal("state"),
    query: z.string(),
    /** `exists` fires when anything matches, `none` fires when nothing matches. */
    mode: z.enum(["exists", "none"]).default("exists"),
  }),
]);
export type WatchClause = z.infer<typeof WatchClause>;

export const WatchSpec = z.strictObject({
  clauses: z.array(WatchClause).min(1),
  require: z.enum(["any", "all"]).default("any"),
});
export type WatchSpec = z.infer<typeof WatchSpec>;

export const EntitySummary = z.object({
  kind: EntityKind,
  ref: z.string(),
  title: z.string(),
  status: z.string(),
  project: z.string().nullable(),
  priority: Priority.nullable(),
  assignee: z.string().nullable(),
  version: z.number().int(),
  updatedAt: z.string(),
});
export type EntitySummary = z.infer<typeof EntitySummary>;

export const WatchClauseResult = z.object({
  index: z.number().int(),
  type: z.enum(["event", "state"]),
  query: z.string(),
  satisfied: z.boolean(),
  events: z.array(FeedEvent),
  entities: z.array(EntitySummary),
});
export type WatchClauseResult = z.infer<typeof WatchClauseResult>;

export const Watch = z.object({
  ref: z.string(),
  name: z.string().nullable(),
  agent: z.string(),
  spec: WatchSpec,
  cursor: z.number().int(),
  follow: z.boolean(),
  ephemeral: z.boolean(),
  status: WatchStatus,
  refs: z.array(z.string()),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  firedAt: z.string().nullable(),
  /** True while the watching agent has polled recently, so the dashboard can say someone is really waiting. */
  waiting: z.boolean(),
});
export type Watch = z.infer<typeof Watch>;

export const WatchResult = z.object({
  watch: z.string(),
  name: z.string().nullable(),
  fired: z.boolean(),
  cursor: z.number().int(),
  clauses: z.array(WatchClauseResult),
});
export type WatchResult = z.infer<typeof WatchResult>;

export const DecisionCard = z.object({
  decision: Decision,
  score: z.number(),
  reasons: z.array(z.string()),
  blocks: z.array(EntitySummary),
  affects: z.array(EntitySummary),
  waiters: z.array(z.string()),
});
export type DecisionCard = z.infer<typeof DecisionCard>;

export const PrCard = z.object({
  pr: PullRequest,
  issues: z.array(z.string()),
  attention: z.array(z.string()),
  openDrift: z.number().int(),
});
export type PrCard = z.infer<typeof PrCard>;

export const IssueCard = z.object({
  issue: Issue,
  blockedBy: z.array(z.string()),
  blocking: z.array(z.string()),
  prs: z.array(z.string()),
  openDrift: z.number().int(),
});
export type IssueCard = z.infer<typeof IssueCard>;

export const ProjectStats = z.object({
  issuesTotal: z.number().int(),
  issuesClosed: z.number().int(),
  issuesActive: z.number().int(),
  issuesBlocked: z.number().int(),
  openDecisions: z.number().int(),
  openPrs: z.number().int(),
  openDrift: z.number().int(),
});
export type ProjectStats = z.infer<typeof ProjectStats>;

export const ProjectCard = z.object({ project: Project, stats: ProjectStats });
export type ProjectCard = z.infer<typeof ProjectCard>;

export const RoadmapItem = z.object({
  ref: z.string(),
  kind: z.enum(["project", "milestone", "idea", "issue"]),
  title: z.string(),
  project: z.string().nullable(),
  status: z.string(),
  horizon: Horizon,
  targetDate: z.string().nullable(),
  done: z.number().int(),
  total: z.number().int(),
  blockedBy: z.array(z.string()),
  openDecisions: z.array(z.string()),
});
export type RoadmapItem = z.infer<typeof RoadmapItem>;

export const RoadmapLane = z.object({
  horizon: z.enum(["now", "next", "later"]),
  items: z.array(RoadmapItem),
});
export type RoadmapLane = z.infer<typeof RoadmapLane>;

export const Roadmap = z.object({
  generatedAt: z.string(),
  project: z.string().nullable(),
  lanes: z.array(RoadmapLane),
  markdown: z.string(),
});
export type Roadmap = z.infer<typeof Roadmap>;

export const Counts = z.object({
  openDecisions: z.number().int(),
  openDrift: z.number().int(),
  openPrs: z.number().int(),
  failingPrs: z.number().int(),
  activeIssues: z.number().int(),
  blockedIssues: z.number().int(),
  waitingWatches: z.number().int(),
  ideas: z.number().int(),
});
export type Counts = z.infer<typeof Counts>;

export const FeedPage = z.object({
  events: z.array(FeedEvent),
  /** Pass as `before` to fetch older events, null when exhausted. */
  nextBefore: z.number().int().nullable(),
  cursor: z.number().int(),
});
export type FeedPage = z.infer<typeof FeedPage>;

export const SyncFailure = z.object({ repo: z.string(), error: z.string(), updatedAt: z.string() });
export type SyncFailure = z.infer<typeof SyncFailure>;

export const Bootstrap = z.object({
  cursor: z.number().int(),
  syncFailures: z.array(SyncFailure),
  counts: Counts,
  queue: z.array(DecisionCard),
  prs: z.array(PrCard),
  projects: z.array(ProjectCard),
  views: z.array(View),
  watches: z.array(Watch),
  feed: FeedPage,
  facets: z.object({
    actors: z.array(z.string()),
    labels: z.array(z.string()),
    eventTypes: z.array(z.string()),
  }),
});
export type Bootstrap = z.infer<typeof Bootstrap>;

export const EntityDetail = z.object({
  summary: EntitySummary,
  entity: z.union([Project, Issue, Decision, PullRequest, Milestone, Idea, StatusUpdate, Drift]),
  links: z.array(Link),
  linked: z.array(EntitySummary),
  drift: z.array(Drift),
  updates: z.array(StatusUpdate),
  history: z.array(FeedEvent),
});
export type EntityDetail = z.infer<typeof EntityDetail>;

export const NextWork = z.object({
  agent: z.string(),
  drift: z.array(Drift),
  awaitingDecisions: z.array(Decision),
  resolvedDecisions: z.array(Decision),
  claimed: z.array(IssueCard),
  prs: z.array(PrCard),
  ready: z.array(IssueCard),
  summary: z.string(),
});
export type NextWork = z.infer<typeof NextWork>;
