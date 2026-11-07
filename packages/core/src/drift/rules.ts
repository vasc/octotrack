import { z } from "zod";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import type { GraphSnapshot } from "../store/graph.ts";

/** A drift that should exist right now, according to the current state of the tracker. */
export interface DesiredDrift {
  rule: string;
  dedupeKey: string;
  /** An attestation stands until this changes. Pick what would make a human look again. */
  fingerprint: string;
  target: string;
  cause: string | null;
  project: string | null;
  message: string;
  suggestion: string;
}

export const STALE_IN_PROGRESS_MS = 48 * 3_600_000;

const LinkedPrIssue = z.object({
  pr: z.string(),
  state: z.string(),
  prProject: z.string().nullable(),
  issue: z.string(),
  status: z.string(),
  project: z.string(),
});

const LINKED_PR_ISSUE_SQL = `
  SELECT p.ref AS pr, p.state AS state, p.project AS prProject, i.ref AS issue, i.status AS status, i.project AS project
  FROM links l
  JOIN prs p ON l.fromRef = p.ref
  JOIN issues i ON l.toRef = i.ref
  WHERE l.rel = 'implements'
`;

const IssueLite = z.object({
  ref: z.string(),
  project: z.string(),
  status: z.string(),
  /** The later of its last change and its last status update, since reporting progress is activity too. */
  activeAt: z.string(),
});

const PrLite = z.object({
  ref: z.string(),
  project: z.string().nullable(),
  headSha: z.string(),
  state: z.string(),
  checks: z.string(),
  review: z.string(),
  mergeable: z.string(),
});

const Rollup = z.object({
  ref: z.string(),
  status: z.string(),
  targetDate: z.string().nullable(),
  project: z.string().nullable(),
  total: z.number().int(),
  closed: z.number().int(),
});

/** Replaced with the drift's own ref once it has one. */
export const DRIFT_REF = "{drift}";

/** Names the one drift, not its target: an agent answering this should not clear other rules' drift by accident. */
function ack(_ref: string): string {
  return `octo drift ack ${DRIFT_REF} --verified "why this is correct as it is"`;
}

function prIssueRules(ctx: Ctx): DesiredDrift[] {
  const pairs = rows(ctx, LinkedPrIssue, LINKED_PR_ISSUE_SQL);
  const desired: DesiredDrift[] = [];
  const liveOrMerged = new Set(pairs.filter((pair) => pair.state !== "closed").map((pair) => pair.issue));
  for (const pair of pairs) {
    const issueClosed = pair.status === "done" || pair.status === "cancelled";
    const prOpen = pair.state === "open" || pair.state === "draft";
    if (issueClosed && prOpen) {
      desired.push({
        rule: "issue-closed-pr-open",
        dedupeKey: `issue-closed-pr-open:${pair.pr}:${pair.issue}`,
        fingerprint: `${pair.status}|${pair.state}`,
        target: pair.pr,
        cause: pair.issue,
        project: pair.project,
        message: `${pair.issue} is ${pair.status} but ${pair.pr} is still ${pair.state}`,
        suggestion: `Merge or close ${pair.pr}, reopen ${pair.issue}, or: ${ack(pair.pr)}`,
      });
    }
    if (pair.state === "merged" && !issueClosed) {
      desired.push({
        rule: "pr-merged-issue-open",
        dedupeKey: `pr-merged-issue-open:${pair.issue}:${pair.pr}`,
        fingerprint: pair.status,
        target: pair.issue,
        cause: pair.pr,
        project: pair.project,
        message: `${pair.pr} is merged but ${pair.issue} is still ${pair.status}`,
        suggestion: `octo issue update ${pair.issue} --status done, or: ${ack(pair.issue)}`,
      });
    }
    if (pair.state === "closed" && pair.status === "in_review" && !liveOrMerged.has(pair.issue)) {
      desired.push({
        rule: "pr-closed-issue-in-review",
        dedupeKey: `pr-closed-issue-in-review:${pair.issue}:${pair.pr}`,
        fingerprint: pair.status,
        target: pair.issue,
        cause: pair.pr,
        project: pair.project,
        message: `${pair.pr} was closed without merging but ${pair.issue} is still in review`,
        suggestion: `octo issue update ${pair.issue} --status todo, or: ${ack(pair.issue)}`,
      });
    }
  }
  return desired;
}

function issueRules(ctx: Ctx, graph: GraphSnapshot): DesiredDrift[] {
  const desired: DesiredDrift[] = [];
  const issues = rows(
    ctx,
    IssueLite,
    `SELECT i.ref, i.project, i.status, MAX(i.updatedAt, COALESCE(MAX(u.createdAt), i.updatedAt)) AS activeAt
     FROM issues i LEFT JOIN updates u ON u.target = i.ref GROUP BY i.ref`,
  );
  const withPr = new Set(graph.links.filter((link) => link.rel === "implements").map((link) => link.toRef));
  const staleBefore = Date.parse(ctx.now) - STALE_IN_PROGRESS_MS;
  for (const issue of issues) {
    const blockers = graph.blockersOf(issue.ref);
    const openBlockers = blockers.filter((blocker) => graph.open.has(blocker));
    const closed = issue.status === "done" || issue.status === "cancelled";
    if (issue.status === "blocked" && blockers.length > 0 && openBlockers.length === 0) {
      desired.push({
        rule: "blocked-issue-unblocked",
        dedupeKey: `blocked-issue-unblocked:${issue.ref}`,
        fingerprint: [...blockers].sort().join(","),
        target: issue.ref,
        cause: blockers[0] ?? null,
        project: issue.project,
        message: `${issue.ref} is marked blocked but everything blocking it (${blockers.join(", ")}) is resolved`,
        suggestion: `octo issue update ${issue.ref} --status todo, or: ${ack(issue.ref)}`,
      });
    }
    if ((issue.status === "in_progress" || issue.status === "in_review") && openBlockers.length > 0) {
      desired.push({
        rule: "working-while-blocked",
        dedupeKey: `working-while-blocked:${issue.ref}`,
        fingerprint: `${issue.status}|${[...openBlockers].sort().join(",")}`,
        target: issue.ref,
        cause: openBlockers[0] ?? null,
        project: issue.project,
        message: `${issue.ref} is ${issue.status} while still blocked by ${openBlockers.join(", ")}`,
        suggestion: `octo issue update ${issue.ref} --status blocked, or: ${ack(issue.ref)}`,
      });
    }
    if (closed && openBlockers.length > 0) {
      desired.push({
        rule: "closed-with-open-blocker",
        dedupeKey: `closed-with-open-blocker:${issue.ref}`,
        fingerprint: `${issue.status}|${[...openBlockers].sort().join(",")}`,
        target: issue.ref,
        cause: openBlockers[0] ?? null,
        project: issue.project,
        message: `${issue.ref} is ${issue.status} but ${openBlockers.join(", ")} still blocks it`,
        suggestion: `Remove the link, reopen ${issue.ref}, or: ${ack(issue.ref)}`,
      });
    }
    if (issue.status === "in_review" && !withPr.has(issue.ref)) {
      desired.push({
        rule: "in-review-without-pr",
        dedupeKey: `in-review-without-pr:${issue.ref}`,
        fingerprint: issue.status,
        target: issue.ref,
        cause: null,
        project: issue.project,
        message: `${issue.ref} is in review but no pull request is linked to it`,
        suggestion: `octo link add <PR> implements ${issue.ref}, or: ${ack(issue.ref)}`,
      });
    }
    if (issue.status === "in_progress" && Date.parse(issue.activeAt) < staleBefore) {
      desired.push({
        rule: "stale-in-progress",
        dedupeKey: `stale-in-progress:${issue.ref}`,
        fingerprint: issue.activeAt,
        target: issue.ref,
        cause: null,
        project: issue.project,
        message: `${issue.ref} has been in progress with no activity since ${issue.activeAt}`,
        suggestion: `octo post "where this stands" --on ${issue.ref}, update it, or: ${ack(issue.ref)}`,
      });
    }
  }
  return desired;
}

function prRules(ctx: Ctx, graph: GraphSnapshot): DesiredDrift[] {
  const desired: DesiredDrift[] = [];
  const prs = rows(
    ctx,
    PrLite,
    "SELECT ref, project, headSha, state, checks, review, mergeable FROM prs WHERE state IN ('open', 'draft')",
  );
  for (const pr of prs) {
    if (pr.checks === "failing") {
      desired.push({
        rule: "pr-checks-failing",
        dedupeKey: `pr-checks-failing:${pr.ref}`,
        fingerprint: pr.headSha,
        target: pr.ref,
        cause: null,
        project: pr.project,
        message: `${pr.ref} has failing checks`,
        suggestion: `Fix the checks on ${pr.ref}, or: ${ack(pr.ref)}`,
      });
    }
    if (pr.review === "changes_requested") {
      desired.push({
        rule: "pr-changes-requested",
        dedupeKey: `pr-changes-requested:${pr.ref}`,
        fingerprint: pr.headSha,
        target: pr.ref,
        cause: null,
        project: pr.project,
        message: `Changes were requested on ${pr.ref}`,
        suggestion: `Address the review on ${pr.ref}, or: ${ack(pr.ref)}`,
      });
    }
    if (pr.mergeable === "conflicting") {
      desired.push({
        rule: "pr-conflicting",
        dedupeKey: `pr-conflicting:${pr.ref}`,
        fingerprint: pr.headSha,
        target: pr.ref,
        cause: null,
        project: pr.project,
        message: `${pr.ref} has merge conflicts`,
        suggestion: `Resolve the conflicts on ${pr.ref}, or: ${ack(pr.ref)}`,
      });
    }
    if (pr.state === "open" && graph.from(pr.ref, "implements").length === 0) {
      desired.push({
        rule: "pr-without-issue",
        dedupeKey: `pr-without-issue:${pr.ref}`,
        fingerprint: "unlinked",
        target: pr.ref,
        cause: null,
        project: pr.project,
        message: `${pr.ref} is not linked to any issue`,
        suggestion: `octo link add ${pr.ref} implements <ISSUE>, or: ${ack(pr.ref)}`,
      });
    }
  }
  return desired;
}

function rollupRules(ctx: Ctx): DesiredDrift[] {
  const desired: DesiredDrift[] = [];
  const milestones = rows(
    ctx,
    Rollup,
    `SELECT m.ref, m.status, m.targetDate, m.project,
       COUNT(i.ref) AS total,
       COALESCE(SUM(CASE WHEN i.status IN ('done', 'cancelled') THEN 1 ELSE 0 END), 0) AS closed
     FROM milestones m LEFT JOIN issues i ON i.milestone = m.ref
     WHERE m.status IN ('planned', 'active') GROUP BY m.ref`,
  );
  for (const milestone of milestones) {
    if (milestone.total > 0 && milestone.closed === milestone.total) {
      desired.push({
        rule: "milestone-complete",
        dedupeKey: `milestone-complete:${milestone.ref}`,
        fingerprint: String(milestone.total),
        target: milestone.ref,
        cause: null,
        project: milestone.project,
        message: `Every issue in ${milestone.ref} is closed but it is still ${milestone.status}`,
        suggestion: `octo milestone update ${milestone.ref} --status done, or: ${ack(milestone.ref)}`,
      });
    }
    // Compared by day: a milestone due today is not late yet.
    if (milestone.targetDate !== null && milestone.targetDate.slice(0, 10) < ctx.now.slice(0, 10)) {
      desired.push({
        rule: "milestone-overdue",
        dedupeKey: `milestone-overdue:${milestone.ref}`,
        fingerprint: milestone.targetDate,
        target: milestone.ref,
        cause: null,
        project: milestone.project,
        message: `${milestone.ref} is past its target date of ${milestone.targetDate}`,
        suggestion: `octo milestone update ${milestone.ref} --target-date <date>, or: ${ack(milestone.ref)}`,
      });
    }
  }
  const projects = rows(
    ctx,
    Rollup,
    `SELECT p.ref, p.status, p.targetDate, p.ref AS project,
       COUNT(i.ref) AS total,
       COALESCE(SUM(CASE WHEN i.status IN ('done', 'cancelled') THEN 1 ELSE 0 END), 0) AS closed
     FROM projects p LEFT JOIN issues i ON i.project = p.ref
     WHERE p.status NOT IN ('paused') GROUP BY p.ref`,
  );
  for (const project of projects) {
    if (project.status === "active" && project.total > 0 && project.closed === project.total) {
      desired.push({
        rule: "project-work-complete",
        dedupeKey: `project-work-complete:${project.ref}`,
        fingerprint: String(project.total),
        target: project.ref,
        cause: null,
        project: project.ref,
        message: `Every issue in ${project.ref} is closed but the project is still active`,
        suggestion: `octo project update ${project.ref} --status done, or: ${ack(project.ref)}`,
      });
    }
    if ((project.status === "done" || project.status === "archived") && project.closed < project.total) {
      desired.push({
        rule: "project-closed-open-work",
        dedupeKey: `project-closed-open-work:${project.ref}`,
        fingerprint: `${project.status}|${project.total - project.closed}`,
        target: project.ref,
        cause: null,
        project: project.ref,
        message: `${project.ref} is ${project.status} but has ${project.total - project.closed} open issues`,
        suggestion: `Close the issues, reopen ${project.ref}, or: ${ack(project.ref)}`,
      });
    }
  }
  return desired;
}

/** Every level rule, evaluated from scratch. See docs/DESIGN.md, D6, for why this is not incremental. */
export function evaluateLevelRules(ctx: Ctx, graph: GraphSnapshot): DesiredDrift[] {
  return [...prIssueRules(ctx), ...issueRules(ctx, graph), ...prRules(ctx, graph), ...rollupRules(ctx)];
}
