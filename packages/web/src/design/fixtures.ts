import type { DecisionForm } from "../hooks/useDecisionForm.ts";
import type {
  AgentView,
  Decision,
  DecisionCard,
  Drift,
  FeedEvent,
  Idea,
  Issue,
  Line,
  LineHome,
  PendingChoice,
  PlanBranch,
  PlanStep,
  Project,
  PullRequest,
} from "@octotrack/core/schemas";

/** Made-up data shared by the /design specimen and the presentational tests, so that both show the same things. */
const AT = "2026-11-07T10:00:00.000Z";

export function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    ref: "D-1",
    project: "OCT",
    heldAt: null,
    kind: "architecture",
    title: "Which queue?",
    context: "We need at-least-once delivery.",
    options: [
      { key: "sqs", label: "SQS", description: "Managed" },
      { key: "redis", label: "Redis", description: "" },
    ],
    recommendation: "redis",
    status: "open",
    priority: "high",
    requestedBy: "agent-a",
    dueAt: null,
    chosenOption: null,
    resolutionNote: null,
    postponedAt: null,
    wakeAddress: null,
    wokenAt: null,
    wakeError: null,
    pickedUpAt: null,
    pickedUpBy: null,
    reportStatus: null,
    reportNote: null,
    reportedAt: null,
    decidedBy: null,
    decidedAt: null,
    channel: null,
    sourceUrl: null,
    supersededBy: null,
    line: null,
    issue: null,
    recommendationWhy: null,
    urgentReason: null,
    notUrgentAt: null,
    confirmedAt: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function decisionCard(overrides: Partial<DecisionCard> = {}): DecisionCard {
  return { decision: decision(), reasons: [], blocks: [], affects: [], waiters: [], ...overrides };
}

export function pr(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    ref: "PR-1",
    repo: "acme/app",
    number: 12,
    project: "OCT",
    title: "Add retry",
    body: "",
    url: "https://github.com/acme/app/pull/12",
    state: "open",
    checks: "passing",
    review: "none",
    mergeable: "clean",
    headRef: "feature/retry",
    baseRef: "main",
    headSha: "abc",
    author: "agent-a",
    additions: 10,
    deletions: 2,
    mergedAt: null,
    closedAt: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    syncedAt: AT,
    ...overrides,
  };
}

export function event(overrides: Partial<FeedEvent> = {}): FeedEvent {
  return {
    seq: 1,
    ts: AT,
    actor: "agent-a",
    type: "issue.created",
    kind: "issue",
    ref: "OCT-1",
    project: "OCT",
    line: null,
    summary: "OCT-1 created: Thing",
    related: [],
    attrs: {},
    changes: {},
    ...overrides,
  };
}

export function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    ref: "OCT-1",
    project: "OCT",
    lastAssignee: null,
    lastAssignedAt: null,
    heldAt: null,
    title: "Thing",
    body: "",
    status: "todo",
    priority: "medium",
    assignee: null,
    labels: [],
    milestone: null,
    line: null,
    step: null,
    place: null,
    outcome: null,
    fields: [],
    result: null,
    confirmedAt: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    closedAt: null,
    createdBy: "agent-a",
    ...overrides,
  };
}

export function drift(overrides: Partial<Drift> = {}): Drift {
  return {
    ref: "DR-1",
    rule: "decision-outcome",
    dedupeKey: "k",
    fingerprint: "f",
    edge: true,
    target: "PR-1",
    cause: "OCT-1",
    viaLink: false,
    project: "OCT",
    message: "OCT-1 is done but PR-1 is still open",
    suggestion: "Merge PR-1",
    status: "open",
    assignee: null,
    claimedBy: null,
    baselineAt: AT,
    resolvedBy: null,
    resolvedAt: null,
    note: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function decisionForm(overrides: Partial<DecisionForm> = {}): DecisionForm {
  return {
    ownWords: null,
    sending: false,
    notSaved: false,
    answer: () => {},
    openOwn: () => {},
    closeOwn: () => {},
    setOwn: () => {},
    sendOwn: () => {},
    postpone: () => {},
    notUrgent: () => {},
    waiting: null,
    ...overrides,
  };
}

export function line(overrides: Partial<Line> = {}): Line {
  return {
    ref: "L-1",
    title: "Sendspin enclosure",
    doneWhen: "A printed case holds the board and takes the USB-C plug.",
    state: "working",
    rank: 1,
    headline: null,
    summary: null,
    summaryAt: null,
    tabledReason: null,
    lookAgainAt: null,
    proposedBy: null,
    recommendation: null,
    recommendationWhy: null,
    source: "developer",
    fromRef: null,
    scopedAt: null,
    windDownUntil: null,
    ownedBy: null,
    doneWhenProposal: null,
    doneWhenWhy: null,
    doneWhenProposedBy: null,
    doneProposal: null,
    doneProposedBy: null,
    urgentReason: null,
    seenAt: null,
    startAnyway: null,
    repos: ["PANEL"],
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    createdBy: "dev",
    ...overrides,
  };
}

export function pendingChoice(overrides: Partial<PendingChoice> = {}): PendingChoice {
  return {
    id: 1,
    op: "line.start",
    ref: null,
    line: null,
    draft: null,
    summary: "Starting Wall mount",
    dueAt: "2026-11-14T09:00:05.000Z",
    state: "pending",
    error: null,
    createdAt: "",
    ...overrides,
  };
}

export function agentView(overrides: Partial<AgentView> = {}): AgentView {
  return {
    name: "panel",
    note: null,
    firstSeenAt: "2026-11-14T09:00:00.000Z",
    lastSeenAt: "2026-11-14T09:00:00.000Z",
    checkout: "/src/panel",
    repo: "PANEL",
    wakeAddress: "screen:abc",
    startedBy: null,
    stoppedAt: null,
    stoppedReason: null,
    goneAt: null,
    wokenAt: null,
    wakeError: null,
    state: "asleep",
    line: "L-2",
    role: "owner",
    lastLine: null,
    start: null,
    ...overrides,
  };
}

export function project(overrides: Partial<Project> = {}): Project {
  return {
    ref: "PANEL",
    name: "Home panel",
    description: "",
    status: "active",
    repo: "vasc/homepanel",
    checkout: null,
    horizon: "now",
    targetDate: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    createdBy: "dev",
    ...overrides,
  };
}

export function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    ref: "I-7",
    project: null,
    title: "Family devices",
    body: "",
    status: "captured",
    horizon: "later",
    labels: [],
    promotedTo: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    createdBy: "dev",
    ...overrides,
  };
}

/** How a line stands on home, with nothing waiting and no plan unless given. */
export function lineHome(overrides: Partial<LineHome> = {}): LineHome {
  return {
    start: null,
    step: null,
    branchesOpen: 0,
    branchOf: null,
    forYou: [],
    stepIn: false,
    stepInReason: null,
    stepInKind: null,
    waitingOnYou: false,
    held: { questions: 0, tasks: 0 },
    reconfirming: 0,
    sinceSummary: 0,
    scopedSteps: 0,
    answers: [],
    ...overrides,
  };
}

/** A step on a plan's critical path by its position, its id and address following from it unless given. */
export function planStep(overrides: Partial<PlanStep> & Pick<PlanStep, "position" | "title">): PlanStep {
  return {
    id: overrides.position,
    line: "L-7",
    branch: null,
    address: String(overrides.position),
    status: "todo",
    ...overrides,
  };
}

/** A branch of a plan, open and holding nothing up unless given. */
export function planBranch(
  overrides: Partial<PlanBranch> & Pick<PlanBranch, "id" | "fromStep" | "address" | "title">,
): PlanBranch {
  return {
    line: "L-7",
    position: 1,
    holdsUp: null,
    became: null,
    state: "open",
    ...overrides,
  };
}
