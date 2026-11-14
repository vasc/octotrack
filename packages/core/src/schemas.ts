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
  "line",
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

/** What an event is about: any item, or an agent, which is not an item you open by ref. */
export const EventKind = z.enum([...EntityKind.options, "agent"]);
export type EventKind = z.infer<typeof EventKind>;

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
  /** The line of work this issue is part of, and the step of its plan it belongs to. */
  line: z.string().nullable(),
  step: z.number().int().nullable(),
  /** A task, which is an issue for the developer: where it is done, and what to report when it is. */
  place: z.string().nullable(),
  outcome: z.string().nullable(),
  /** What the developer reported, or why it could not be done. */
  result: z.string().nullable(),
  /** When an agent last said a held task still stands. */
  confirmedAt: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  createdBy: z.string(),
});
export type Issue = z.infer<typeof Issue>;

/** Where a line stands. Only the developer moves a line between these; agents propose. */
export const LineState = z.enum(["proposed", "working", "up_next", "tabled", "done", "dropped"]);
export type LineState = z.infer<typeof LineState>;

/** What an agent recommends doing with a line it proposes. */
export const LinePlacement = z.enum(["start", "up_next", "table", "fold"]);
export type LinePlacement = z.infer<typeof LinePlacement>;

export const LineSource = z.enum(["developer", "agent", "migration"]);
export type LineSource = z.infer<typeof LineSource>;

export const Line = z.object({
  ref: z.string(),
  title: z.string(),
  /** One sentence saying when the line is finished. */
  doneWhen: z.string(),
  state: LineState,
  /** Position within its section; lower comes first. The developer's order is everyone's order. */
  rank: z.number(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  summaryAt: z.string().nullable(),
  tabledReason: z.string().nullable(),
  lookAgainAt: z.string().nullable(),
  proposedBy: z.string().nullable(),
  recommendation: LinePlacement.nullable(),
  recommendationWhy: z.string().nullable(),
  source: LineSource,
  /** The idea or milestone a line migrated from, so it can be shown as coming from before. */
  fromRef: z.string().nullable(),
  /** When its scoper released it with a done when and a plan. Up-next lines need scoping again after eight weeks. */
  scopedAt: z.string().nullable(),
  /** While set, the agents that held it when it left working on may still wrap up. */
  windDownUntil: z.string().nullable(),
  /** "dev" when the developer owns it: no agent writes to it until it is handed back. */
  ownedBy: z.string().nullable(),
  /** A done when an agent proposed, waiting for the developer to accept it or keep the one there is. */
  doneWhenProposal: z.string().nullable(),
  doneWhenProposedBy: z.string().nullable(),
  /** The owner's case that the line is done, waiting for the developer. */
  doneProposal: z.string().nullable(),
  doneProposedBy: z.string().nullable(),
  repos: z.array(z.string()),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});
export type Line = z.infer<typeof Line>;

export const PlanStepStatus = z.enum(["todo", "doing", "done"]);
export type PlanStepStatus = z.infer<typeof PlanStepStatus>;

export const PlanStep = z.object({
  line: z.string(),
  position: z.number().int(),
  title: z.string(),
  status: PlanStepStatus,
});
export type PlanStep = z.infer<typeof PlanStep>;

export const DecisionOption = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
});
export type DecisionOption = z.infer<typeof DecisionOption>;

export const DecisionReportStatus = z.enum(["done", "partial"]);
export type DecisionReportStatus = z.infer<typeof DecisionReportStatus>;

/** The only reasons a question may jump the developer's order. */
export const UrgentReason = z.enum(["time_boxed", "costs_money", "broken"]);
export type UrgentReason = z.infer<typeof UrgentReason>;

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
  /** How to wake the session that asked, if it wants that. Opaque here: `adapter:address`. */
  wakeAddress: z.string().nullable(),
  wokenAt: z.string().nullable(),
  wakeError: z.string().nullable(),
  /** When the agent that asked acknowledged the answer. */
  pickedUpAt: z.string().nullable(),
  pickedUpBy: z.string().nullable(),
  /** What the agent says became of the answer. */
  reportStatus: DecisionReportStatus.nullable(),
  reportNote: z.string().nullable(),
  reportedAt: z.string().nullable(),
  chosenOption: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  channel: Channel.nullable(),
  sourceUrl: z.string().nullable(),
  supersededBy: z.string().nullable(),
  /** The line it was asked on; its answer goes to that line's inbox. Null for a question from before lines. */
  line: z.string().nullable(),
  /** The issue it concerns: its answer goes to whoever holds that issue, else the line's owner. */
  issue: z.string().nullable(),
  /** Why the asker recommends what it does, shown under the options. */
  recommendationWhy: z.string().nullable(),
  /** Set when asked as urgent, for a reason from a fixed set. */
  urgentReason: UrgentReason.nullable(),
  /** When the developer sent an urgent question back to its place in the order. */
  notUrgentAt: z.string().nullable(),
  /** When an agent last said a held question still stands. */
  confirmedAt: z.string().nullable(),
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
  kind: EventKind,
  ref: z.string(),
  project: z.string().nullable(),
  line: z.string().nullable(),
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
  /** The folder it works in. One name is one session in one checkout. */
  checkout: z.string().nullable(),
  /** The repo it serves, a repo key, read from its checkout's remote or given when it registered. */
  repo: z.string().nullable(),
  /** How to wake it, such as claude:<session>, or null when it asked not to be woken. */
  wakeAddress: z.string().nullable(),
  /** "octotrack" for a session Octotrack started; null for one the developer started. */
  startedBy: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  stoppedReason: z.string().nullable(),
  goneAt: z.string().nullable(),
  /** When Octotrack last woke it, and why that failed if it did. */
  wokenAt: z.string().nullable(),
  wakeError: z.string().nullable(),
});
export type Agent = z.infer<typeof Agent>;

/** An agent asleep with something waiting for it, and how to wake it. The message carries no tracker text. */
export const AgentWake = z.object({ agent: z.string(), address: z.string(), message: z.string() });
export type AgentWake = z.infer<typeof AgentWake>;

/** See docs/DESIGN.md, the agent state table. Never decided by silence alone. */
export const AgentState = z.enum(["running", "asleep", "quiet", "gone", "stopped"]);
export type AgentState = z.infer<typeof AgentState>;

export const ClaimRole = z.enum(["owner", "helper", "scoper"]);
export type ClaimRole = z.infer<typeof ClaimRole>;

export const LineClaim = z.object({
  agent: z.string(),
  line: z.string(),
  role: ClaimRole,
  since: z.string(),
});
export type LineClaim = z.infer<typeof LineClaim>;

/** An agent as the roster shows it: with its state and the line it is on. */
export const AgentView = Agent.extend({
  state: AgentState,
  line: z.string().nullable(),
  role: ClaimRole.nullable(),
});
export type AgentView = z.infer<typeof AgentView>;

export const NoticeKind = z.enum([
  "wind_down",
  "stop",
  "promoted",
  "owner_offer",
  "needs_owner",
  "proposal_placed",
  "not_urgent",
  "answer",
  "tell",
  "task_done",
  "task_cant",
  "done_when",
  "keep_going",
  "held_stale",
]);
export type NoticeKind = z.infer<typeof NoticeKind>;

/** Something an agent must hear, carried on its next reply. Some also wake it. */
export const Notice = z.object({
  /** Null for an offer worked out for this reply, which is not stored. */
  id: z.number().int().nullable(),
  agent: z.string(),
  kind: NoticeKind,
  line: z.string().nullable(),
  body: z.string(),
  wakes: z.boolean(),
  createdAt: z.string(),
});
export type Notice = z.infer<typeof Notice>;

export const AgentBrief = z.object({ name: z.string(), state: AgentState });
export type AgentBrief = z.infer<typeof AgentBrief>;

/** Who is on a line, and how far the search for an owner got when there is none. */
export const LineCrew = z.object({
  owner: AgentBrief.nullable(),
  helpers: z.array(AgentBrief),
  scoper: AgentBrief.nullable(),
  search: z
    .object({ step: z.union([z.literal(1), z.literal(2), z.literal(3)]), since: z.string() })
    .nullable(),
});
export type LineCrew = z.infer<typeof LineCrew>;

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
  entity: z.union([Project, Issue, Decision, PullRequest, Milestone, Idea, StatusUpdate, Drift, Line]),
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

export const LineDetail = z.object({
  line: Line,
  steps: z.array(PlanStep),
  issues: z.array(EntitySummary),
});
export type LineDetail = z.infer<typeof LineDetail>;

/** Something on a line waiting on the developer: a question to answer or a task to do. */
export const ForYou = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("question"), card: DecisionCard }),
  z.object({ kind: z.literal("task"), task: Issue }),
]);
export type ForYou = z.infer<typeof ForYou>;

/** What home shows for one line beyond the line itself. */
export const LineHome = z.object({
  /** The first plan step not done, and how many steps there are. */
  step: z.object({ position: z.number().int(), of: z.number().int(), title: z.string() }).nullable(),
  /** On a working line: what waits on the developer, in order. */
  forYou: z.array(ForYou),
  /** On a line not being worked on: the questions and tasks it holds. */
  held: z.object({ questions: z.number().int(), tasks: z.number().int() }),
  /** How many plan steps scoping has written so far. */
  scopedSteps: z.number().int(),
});
export type LineHome = z.infer<typeof LineHome>;

/** The header's counts, each a door to the first such item. */
export const HomeCounts = z.object({
  toAnswer: z.number().int(),
  toDo: z.number().int(),
  toAccept: z.number().int(),
  toStepIn: z.number().int(),
  urgent: z.number().int(),
});
export type HomeCounts = z.infer<typeof HomeCounts>;

/** The home screen: every line, in the developer's order, section by section. */
export const HomeView = z.object({
  /** Urgent questions, which stand at the very top, apart from their lines. */
  urgent: z.array(DecisionCard),
  lines: z.record(z.string(), LineHome),
  counts: HomeCounts,
  working: z.array(Line),
  upNext: z.array(Line),
  proposed: z.array(Line),
  tabled: z.array(Line),
  doneLately: z.array(Line),
  /** Who is on each line that has anyone, or needs someone. */
  crews: z.record(z.string(), LineCrew),
});
export type HomeView = z.infer<typeof HomeView>;

/** What `line take` gave an agent: the line, its role there, and what to do next. */
export const TakeResult = z.object({
  /** Null when there was nothing to take. */
  line: Line.nullable(),
  role: ClaimRole.nullable(),
  next: EntitySummary.nullable(),
  message: z.string(),
});
export type TakeResult = z.infer<typeof TakeResult>;

/** Somewhere the developer does tasks: a fixed list they own. */
export const Place = z.object({ name: z.string(), position: z.number().int() });
export type Place = z.infer<typeof Place>;

/** A question or task waiting on a line nobody is working on. Only current ones reach the developer. */
export const HeldItem = z.object({
  ref: z.string(),
  kind: z.enum(["question", "task"]),
  title: z.string(),
  line: z.string(),
  /** Asked or re-confirmed in the last 7 days. */
  current: z.boolean(),
  since: z.string(),
});
export type HeldItem = z.infer<typeof HeldItem>;

/** A choice the developer made that waits a few seconds, with Undo, before the server applies it. */
export const PendingChoice = z.object({
  id: z.number().int(),
  op: z.string(),
  summary: z.string(),
  dueAt: z.string(),
  state: z.enum(["pending", "applied", "undone", "failed"]),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type PendingChoice = z.infer<typeof PendingChoice>;
