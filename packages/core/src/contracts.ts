import { z } from "zod";
import { isIsoDate } from "./query/match.ts";
import {
  Agent,
  AgentView,
  AtView,
  AgentWake,
  Bootstrap,
  Channel,
  Decision,
  DecisionCard,
  DecisionKind,
  DecisionReportStatus,
  Drift,
  EntityDetail,
  EntitySummary,
  FeedPage,
  HeldItem,
  HomeView,
  Horizon,
  Idea,
  Issue,
  IssueCard,
  IssueStatus,
  Line,
  LineStart,
  LineDetail,
  LinePlacement,
  Notice,
  TakeResult,
  UrgentReason,
  Link,
  LinkRel,
  Milestone,
  NextWork,
  Place,
  PendingChoice,
  PlanStep,
  PushNote,
  PushSubscription,
  RunnerClose,
  RunnerDue,
  RunnerStatus,
  RunnerWorktree,
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
/**
 * `adapter:address`. Kept narrow, since the address ends up as an argument to a command: it cannot start with a dash, so
 * it cannot pass for an option, and holds nothing a shell would read.
 */
const WakeAddress = z.string().regex(/^[a-z][a-z0-9_-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/);
/** A GitHub repo, owner/name: what the runner clones and works in, so nothing else is taken. */
const RepoSlug = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+$/, {
  error: "A GitHub repo is owner/name",
});
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

const LineRef = z.strictObject({ ref: z.string() });

export const contracts = {
  pushSubscribe: write(
    "push.subscribe",
    "Let this browser's phone be buzzed for urgent questions and the top lines (the developer)",
    PushSubscription.strict(),
    z.object({ endpoint: z.string() }),
  ),
  pushUnsubscribe: write(
    "push.unsubscribe",
    "Stop buzzing a browser",
    z.strictObject({ endpoint: z.string() }),
    z.object({ endpoint: z.string() }),
  ),
  pushSubscriptions: read(
    "push.subscriptions",
    "Browsers to buzz. Only the server reads these",
    Empty,
    z.array(PushSubscription),
  ),
  pushSeen: write(
    "push.seen",
    "The developer opened the app: each line may buzz once more",
    Empty,
    z.object({ at: z.string() }),
  ),
  pushDue: read("push.due", "Notifications due to buzz the phone", Empty, z.array(PushNote)),
  pushSent: write(
    "push.sent",
    "Record notifications sent, so each buzzes once",
    z.strictObject({ keys: z.array(z.string()) }),
    z.object({ sent: z.number().int() }),
  ),
  runnerReport: write(
    "runner.report",
    "How the local runner is set up on this machine. The server says this when it starts",
    RunnerStatus.strict(),
    RunnerStatus,
  ),
  runnerDue: read(
    "runner.due",
    "Working lines due a session the start command runs, up to the cap",
    Empty,
    z.array(RunnerDue),
  ),
  runnerStart: write(
    "runner.start",
    "Record a session being started for a line, and give it its name",
    z.strictObject({ line: z.string(), repo: z.string(), worktree: z.string().optional() }),
    z.object({
      name: z.string(),
      line: z.string(),
      repo: z.string(),
      /** A gone session's worktree handed on for this line, to start in instead of a new one. */
      worktree: z.string().nullable(),
    }),
  ),
  runnerExited: write(
    "runner.exited",
    "Record that a session Octotrack started has exited, with its code and last output",
    z.strictObject({ name: z.string(), code: z.number().int(), output: z.string() }),
    LineStart,
  ),
  runnerRetry: write(
    "runner.retry",
    "Try now: start a session for a line again without waiting; with same, every line stopped the same way; with anyway, past the cap, once (the developer)",
    z.strictObject({ line: z.string(), same: z.boolean().optional(), anyway: z.boolean().optional() }),
    z.object({ lines: z.array(z.string()) }),
  ),
  runnerDry: write(
    "runner.dry",
    "Record what the runner would have started, in watch mode",
    z.strictObject({ line: z.string(), repo: z.string() }),
    z.object({ line: z.string() }),
  ),
  runnerCloses: read(
    "runner.closes",
    "Pull requests still open on lines that are done or dropped, once their wind-down is over",
    Empty,
    z.array(RunnerClose),
  ),
  runnerClosed: write(
    "runner.closed",
    "Record that a pull request was closed with its line, or in watch mode that it would have been",
    z.strictObject({ pr: z.string(), dry: z.boolean().optional() }),
    z.object({ pr: z.string() }),
  ),
  runnerRestarted: write(
    "runner.restarted",
    "Settle sessions from before a server restart, whose ends the runner did not see",
    Empty,
    z.object({ settled: z.number().int() }),
  ),
  runnerWorktree: write(
    "runner.worktree",
    "Record a worktree Octotrack made",
    RunnerWorktree.strict(),
    RunnerWorktree,
  ),
  runnerStops: read(
    "runner.stops",
    "Agents the developer stopped whose stop command has not run yet",
    Empty,
    z.array(z.object({ name: z.string() })),
  ),
  runnerStopRan: write(
    "runner.stop_ran",
    "Record that the developer's stop command ran for a stopped agent",
    z.strictObject({ name: z.string(), code: z.number().int(), output: z.string() }),
    z.object({ name: z.string() }),
  ),
  repoCheckout: write(
    "repo.checkout",
    "Set a repo's main checkout on this machine, where new worktrees are made (the developer)",
    z.strictObject({
      repo: z.string(),
      path: z.string().refine((path) => path.startsWith("/"), "An absolute path"),
    }),
    Project,
  ),
  runnerCleanups: read(
    "runner.cleanups",
    "Worktrees Octotrack made that no session uses any more",
    Empty,
    z.array(RunnerWorktree),
  ),
  runnerRemoved: write(
    "runner.removed",
    "Record that a worktree was removed",
    z.strictObject({ path: z.string() }),
    z.object({ path: z.string() }),
  ),
  choiceMake: write(
    "choice.make",
    "Make one of the developer's choices wait a few seconds, with Undo, before it takes effect (the developer)",
    z.strictObject({
      op: z.string(),
      input: z.unknown(),
      summary: Text,
      delayMs: z.number().int().min(0).max(60_000).optional(),
    }),
    PendingChoice,
  ),
  choiceUndo: write(
    "choice.undo",
    "Undo a choice still waiting",
    z.strictObject({ id: z.number().int() }),
    PendingChoice,
  ),
  choiceNow: write(
    "choice.now",
    "Apply a waiting choice at once",
    z.strictObject({ id: z.number().int() }),
    PendingChoice,
  ),
  choiceList: read(
    "choice.list",
    "Choices still waiting to take effect, and any that failed until they are dismissed",
    Empty,
    z.array(PendingChoice),
  ),
  draftSave: write(
    "draft.save",
    "Keep a half-written answer, note or outcome, so it can be finished later or elsewhere; empty clears it",
    z.strictObject({ key: z.string().min(1), text: z.string() }),
    z.object({ key: z.string(), text: z.string().nullable() }),
  ),
  draftGet: read(
    "draft.get",
    "Read a kept draft",
    z.strictObject({ key: z.string().min(1) }),
    z.object({ key: z.string(), text: z.string().nullable() }),
  ),
  lineAdd: write(
    "line.add",
    "Add a line of work where it belongs (the developer)",
    z.strictObject({
      title: Text,
      doneWhen: Text,
      repos: z.array(z.string()).optional(),
      where: z.enum(["working", "up_next", "tabled"]),
      reason: Text.optional(),
      lookAgainAt: DateText.optional(),
    }),
    Line,
  ),
  linePropose: write(
    "line.propose",
    "Propose a line of work, recommending where it goes and why",
    z.strictObject({
      title: Text,
      doneWhen: Text,
      repos: z.array(z.string()).optional(),
      recommendation: LinePlacement,
      why: Text,
      place: z.enum(["start", "queue"]).optional(),
      /** Only for something broken on a line no agent may work on, such as a done service. */
      urgent: UrgentReason.optional(),
    }),
    Line,
  ),
  lineStart: write("line.start", "Start a line: it joins the bottom of working on", LineRef, Line),
  lineQueue: write("line.queue", "Move a line to up next, at the end", LineRef, Line),
  lineTable: write(
    "line.table",
    "Table a line, saying why, with an optional date to look again",
    z.strictObject({ ref: z.string(), reason: Text, lookAgainAt: DateText.optional() }),
    Line,
  ),
  lineDone: write("line.done", "Finish a line", LineRef, Line),
  lineDrop: write("line.drop", "Drop a line", LineRef, Line),
  lineReject: write("line.reject", "Not a line: drop a proposal", LineRef, Line),
  lineFold: write(
    "line.fold",
    "Fold a line into another: its issues move there and it ends",
    z.strictObject({ ref: z.string(), into: z.string() }),
    Line,
  ),
  lineOrder: write(
    "line.order",
    "Move a line within its section: to the top or bottom, or before or after another line",
    z.strictObject({
      ref: z.string(),
      to: z.enum(["top", "bottom"]).optional(),
      before: z.string().optional(),
      after: z.string().optional(),
    }),
    Line,
  ),
  lineShow: read("line.show", "Show a line with its plan and its issues", LineRef, LineDetail),
  lineList: read("line.list", "List lines of work", ListInput, z.array(Line)),
  homeShow: read(
    "home.show",
    "Every line of work, section by section, in the developer's order",
    Empty,
    HomeView,
  ),
  planSet: write(
    "plan.set",
    "Set a line's plan: its steps, in order",
    z.strictObject({ line: z.string(), steps: z.array(Text).min(1) }),
    z.array(PlanStep),
  ),
  projectCreate: write(
    "project.create",
    "Create a project",
    z.strictObject({
      key: z.string(),
      name: Text,
      description: z.string().optional(),
      status: ProjectStatus.optional(),
      repo: RepoSlug.optional(),
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
      repo: RepoSlug.nullable().optional(),
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
      line: z.string().optional(),
      step: z.number().int().positive().optional(),
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
      line: z.string().nullable().optional(),
      step: z.number().int().positive().nullable().optional(),
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
      wake: WakeAddress.optional(),
      /** The line it is asked on. Default: the line the asker is on. */
      line: z.string().optional(),
      /** The issue it concerns. Default: the one the asker holds on that line. */
      issue: z.string().optional(),
      /** Why the recommendation. Required with one, on a line. */
      why: Text.optional(),
      /** Only on a line being worked on, and only for one of these reasons. */
      urgent: UrgentReason.optional(),
      /** A task whose outcome would settle this: the question waits behind it. */
      waitsFor: z.string().optional(),
    }),
    Decision,
  ),
  taskFile: write(
    "task.file",
    "File a task for the developer: where it is done, what to report, and the issue it frees",
    z.strictObject({
      title: Text,
      place: z.string(),
      outcome: Text,
      body: z.string().optional(),
      line: z.string().optional(),
      /** The issue it frees. Default: the one you hold on the line. */
      frees: z.string().optional(),
    }),
    Issue,
  ),
  taskDone: write(
    "task.done",
    "Done: report the task's outcome, which goes to whoever holds the issue it frees (the developer)",
    z.strictObject({ ref: z.string(), result: Text }),
    Issue,
  ),
  taskCant: write(
    "task.cant",
    "Can't do it: say why, which closes the task as not done (the developer)",
    z.strictObject({ ref: z.string(), why: Text }),
    Issue,
  ),
  placeList: read("place.list", "The places the developer does tasks, in their order", Empty, z.array(Place)),
  placeAdd: write("place.add", "Add a place (the developer)", z.strictObject({ name: Text }), z.array(Place)),
  placeRemove: write(
    "place.remove",
    "Remove a place (the developer)",
    z.strictObject({ name: z.string() }),
    z.array(Place),
  ),
  heldList: read(
    "held.list",
    "Questions and tasks held on a line, each saying whether it is still current",
    z.strictObject({ line: z.string() }),
    z.array(HeldItem),
  ),
  at: write(
    "at",
    "I'm at a place: home opens its tasks for a few hours; with no place, it leaves (the developer)",
    z.strictObject({ place: z.string().optional() }),
    AtView.nullable(),
  ),
  seen: write(
    "seen",
    "Mark a line as looked at, or every line with none, so the log's not-seen starts after now (the developer)",
    z.strictObject({ line: z.string().optional() }),
    z.object({ lines: z.number().int() }),
  ),
  taskAdd: write(
    "task.add",
    "Add a task of your own to a line you own, at a place or none (the developer)",
    z.strictObject({
      line: z.string(),
      title: Text,
      place: z.string().optional(),
      body: z.string().optional(),
    }),
    Issue,
  ),
  noteAdd: write(
    "note.add",
    "Add a note to a line you own (the developer)",
    z.strictObject({ line: z.string(), body: Text }),
    z.object({ line: z.string() }),
  ),
  heldWithdraw: write(
    "held.withdraw",
    "Withdraw held questions or tasks on your line that no longer stand",
    z.strictObject({ refs: z.array(z.string()).min(1), why: Text.optional() }),
    z.object({ withdrawn: z.array(z.string()) }),
  ),
  heldConfirm: write(
    "held.confirm",
    "Say held questions or tasks still stand, which makes them current for another 7 days",
    z.strictObject({ refs: z.array(z.string()).min(1) }),
    z.array(HeldItem),
  ),
  lineSummarize: write(
    "line.summarize",
    "Rewrite a line's summary and its headline, which stands alone (the owner)",
    z.strictObject({ ref: z.string(), headline: Text, summary: Text }),
    Line,
  ),
  lineDoneWhen: write(
    "line.done_when",
    "Set a line's done when (the developer), or propose a new one (its agents)",
    z.strictObject({ ref: z.string(), doneWhen: Text }),
    Line,
  ),
  lineDoneWhenAnswer: write(
    "line.done_when_answer",
    "Accept a proposed done when, or keep the one there is (the developer)",
    z.strictObject({ ref: z.string(), accept: z.boolean() }),
    Line,
  ),
  lineProposeDone: write(
    "line.propose_done",
    "Propose that a line is done, saying why (the owner)",
    z.strictObject({ ref: z.string(), why: Text }),
    Line,
  ),
  lineNotYet: write(
    "line.not_yet",
    "Turn down a proposal that a line is done, saying what is missing; the owner hears it (the developer)",
    z.strictObject({ ref: z.string(), why: Text.optional() }),
    Line,
  ),
  lineAcceptRecommended: write(
    "line.accept_recommended",
    "Place proposals where their agents recommend, all at once; folds are left for the developer (the developer)",
    z.strictObject({ refs: z.array(z.string()).min(1) }),
    z.array(Line),
  ),
  lineOwn: write(
    "line.own",
    "I'll own it: the line becomes the developer's, and its agents wind down (the developer)",
    z.strictObject({ ref: z.string() }),
    Line,
  ),
  lineHand: write(
    "line.hand",
    "Hand a line the developer owns back to the agents, naming its repos if it has none (the developer)",
    z.strictObject({ ref: z.string(), repos: z.array(z.string()).optional() }),
    Line,
  ),
  decisionNotUrgent: write(
    "decision.not_urgent",
    "Send an urgent question back to its place in the line order (the developer)",
    z.strictObject({ ref: z.string() }),
    Decision,
  ),
  lineTell: write(
    "line.tell",
    "Tell a line's owner something, or whoever holds an issue on it; with no words it is a nudge (the developer)",
    z.strictObject({ line: z.string(), body: z.string(), issue: z.string().optional() }),
    z.object({ line: z.string(), to: z.string().nullable() }),
  ),
  agentWakes: read(
    "agent.wakes",
    "Asleep agents with something waiting for them, and how to wake each",
    Empty,
    z.array(AgentWake),
  ),
  agentWoken: write(
    "agent.woken",
    "Record that an agent was woken, or that the wake failed, which makes it gone",
    z.strictObject({ name: z.string(), error: z.string().optional() }),
    AgentView,
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
  decisionPostpone: write(
    "decision.postpone",
    "Push an open decision to the bottom of the queue without answering it, or undo that",
    z.strictObject({ ref: z.string(), undo: z.boolean().optional() }),
    Decision,
  ),
  decisionInbox: read(
    "decision.inbox",
    "Answers the calling agent has not picked up yet, or every agent's with all",
    z.strictObject({ all: z.boolean().optional() }),
    z.array(Decision),
  ),
  decisionPickup: write(
    "decision.pickup",
    "Acknowledge an answer, taking it out of the inbox",
    z.strictObject({ ref: z.string() }),
    Decision,
  ),
  decisionReport: write(
    "decision.report",
    "Say what became of an answer: done, or only partly",
    z.strictObject({ ref: z.string(), status: DecisionReportStatus, note: Text }),
    Decision,
  ),
  decisionWake: write(
    "decision.wake",
    "Ask to be woken when this is answered, or stop asking with a null address",
    z.strictObject({ ref: z.string(), address: WakeAddress.nullable() }),
    Decision,
  ),
  decisionWakes: read(
    "decision.wakes",
    "Answered decisions whose session asked to be woken and has not been yet",
    z.strictObject({}),
    z.array(Decision),
  ),
  decisionWoken: write(
    "decision.woken",
    "Record that a wake was attempted, and why it failed if it did",
    z.strictObject({ ref: z.string(), error: z.string().optional() }),
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

  ideaList: read("idea.list", "List ideas", ListInput, z.array(Idea)),

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
      /** Only what changed on a line since the developer last looked at it, and never the developer's own doing. */
      unseen: z.boolean().optional(),
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

  agentList: read("agent.list", "Every agent: its state, repo, line and role", Empty, z.array(AgentView)),
  agentRegister: write(
    "agent.register",
    "Say how to wake you (or that you cannot be woken), and which repo you serve when your checkout's remote does not say",
    z.strictObject({ wake: WakeAddress.nullable().optional(), repo: z.string().optional() }),
    AgentView,
  ),
  agentStop: write(
    "agent.stop",
    "Stop an agent: its claims end and every write under its name is refused until lifted (the developer)",
    z.strictObject({ name: z.string(), reason: Text.optional() }),
    AgentView,
  ),
  agentRelease: write(
    "agent.release",
    "End an agent's claim on its line, such as one that went quiet; it may take a line again (the developer)",
    z.strictObject({ name: z.string() }),
    AgentView,
  ),
  agentLift: write(
    "agent.lift",
    "Lift an agent's stop (the developer)",
    z.strictObject({ name: z.string() }),
    AgentView,
  ),
  lineTake: write(
    "line.take",
    "Take a line: by ref, or with none the line you should be on. Says what to do next",
    z.strictObject({ ref: z.string().optional() }),
    TakeResult,
  ),
  lineRelease: write(
    "line.release",
    "Leave your line. A scoper that leaves a done when and a plan leaves it scoped",
    Empty,
    z.object({ line: z.string().nullable() }),
  ),
  agentNote: write(
    "agent.note",
    "Say what the calling agent is working on",
    z.strictObject({ note: z.string().nullable() }),
    Agent,
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
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    driftOpened: z.array(Drift),
    cursor: z.number().int(),
    /** What the calling agent must hear. Older servers send none. */
    notices: z.array(Notice).default([]),
  }),
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
  /** What the calling agent must hear, as on any other reply. */
  notices: z.array(Notice).default([]),
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
  /** What the waiting agent must hear, as on any other reply. */
  notices: z.array(Notice).default([]),
});
export type WatchWaitResponse = z.infer<typeof WatchWaitResponse>;
