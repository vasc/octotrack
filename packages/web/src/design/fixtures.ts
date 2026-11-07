import type { DecisionForm } from "../hooks/useDecisionForm.ts";
import type {
  Decision,
  DecisionCard,
  Drift,
  FeedEvent,
  Issue,
  IssueCard,
  PrCard,
  PullRequest,
} from "@octotrack/core/schemas";

/** Made-up data shared by the /design specimen and the presentational tests, so that both show the same things. */
const AT = "2026-11-07T10:00:00.000Z";

export function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    ref: "D-1",
    project: "OCT",
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
    decidedBy: null,
    decidedAt: null,
    channel: null,
    sourceUrl: null,
    supersededBy: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function decisionCard(overrides: Partial<DecisionCard> = {}): DecisionCard {
  return { decision: decision(), score: 90, reasons: [], blocks: [], affects: [], waiters: [], ...overrides };
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

export function prCard(overrides: Partial<PrCard> = {}): PrCard {
  return { pr: pr(), issues: [], attention: [], openDrift: 0, ...overrides };
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
    title: "Thing",
    body: "",
    status: "todo",
    priority: "medium",
    assignee: null,
    labels: [],
    milestone: null,
    version: 1,
    createdAt: AT,
    updatedAt: AT,
    closedAt: null,
    createdBy: "claude-a",
    ...overrides,
  };
}

export function issueCard(overrides: Partial<IssueCard> = {}): IssueCard {
  return { issue: issue(), blockedBy: [], blocking: [], prs: [], openDrift: 0, ...overrides };
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
    chosen: null,
    note: "",
    elsewhere: false,
    canSubmit: false,
    submitting: false,
    error: null,
    choose: () => {},
    setNote: () => {},
    setElsewhere: () => {},
    submit: () => {},
    ...overrides,
  };
}
