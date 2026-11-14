import type { DecisionForm } from "../hooks/useDecisionForm.ts";
import type {
  Decision,
  DecisionCard,
  Drift,
  FeedEvent,
  Issue,
  Line,
  PendingChoice,
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
    requestedBy: "claude-a",
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
    author: "claude-a",
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
    actor: "claude-a",
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
    result: null,
    confirmedAt: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    closedAt: null,
    createdBy: "claude-a",
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
    error: null,
    answer: () => {},
    openOwn: () => {},
    closeOwn: () => {},
    setOwn: () => {},
    sendOwn: () => {},
    postpone: () => {},
    notUrgent: () => {},
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
