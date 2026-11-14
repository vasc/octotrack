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

const Unplaced = z.object({ project: z.string(), refs: z.string() });

/**
 * Work that is on no line, one drift per repo, so that the move to lines is cleaned up by the agents of each repo
 * rather than by the developer, and without flooding anyone with one drift per issue.
 */
function lineRules(ctx: Ctx): DesiredDrift[] {
  const unplaced = unplacedWork(ctx);
  const covered = new Set(unplaced.map((drift) => drift.project));
  // A repo whose only work is proposals from before still needs its agents to sort them, with nothing else to prompt it.
  const fromBefore = rows(
    ctx,
    Unplaced,
    `SELECT r.repo AS project, group_concat(l.ref, ' ') AS refs
     FROM lines l JOIN line_repos r ON r.line = l.ref AND r.position = 0
     WHERE l.state = 'proposed' AND l.fromRef IS NOT NULL
     GROUP BY r.repo ORDER BY r.repo`,
  )
    .filter((group) => !covered.has(group.project))
    .map((group): DesiredDrift => {
      const refs = group.refs.split(" ").sort();
      const count = refs.length;
      return {
        rule: "unplaced-work",
        dedupeKey: `unplaced-work:${group.project}`,
        fingerprint: refs.join(","),
        target: group.project,
        cause: null,
        project: group.project,
        message: `${count} proposal${count === 1 ? "" : "s"} from before in ${group.project} wait${count === 1 ? "s" : ""} to be re-proposed or rejected`,
        suggestion: `Re-propose each as a line with a recommendation (octo line propose), or say why it is not one in a new proposal's why; the developer rejects the old one. Or: ${ack(group.project)}`,
      };
    });
  return [...unplaced, ...fromBefore];
}

function unplacedWork(ctx: Ctx): DesiredDrift[] {
  return rows(
    ctx,
    Unplaced,
    `SELECT i.project AS project, group_concat(i.ref, ' ') AS refs
     FROM issues i JOIN projects p ON p.ref = i.project
     WHERE i.line IS NULL AND i.status NOT IN ('done', 'cancelled') AND p.status NOT IN ('done', 'archived', 'paused')
       AND i.ref NOT IN (SELECT issue FROM not_a_line)
     GROUP BY i.project ORDER BY i.project`,
  ).map((group) => {
    const refs = group.refs.split(" ").sort();
    const count = refs.length;
    return {
      rule: "unplaced-work",
      dedupeKey: `unplaced-work:${group.project}`,
      fingerprint: refs.join(","),
      target: group.project,
      cause: null,
      project: group.project,
      message: `${count} open issue${count === 1 ? "" : "s"} in ${group.project} ${count === 1 ? "is" : "are"} on no line`,
      suggestion: `Put each on its line (octo issue update <REF> --line L-n), or propose a line for them (octo line propose). An issue that waits on the developer (a measurement, a login, a play-test) is a task: file it with octo task file and close the issue. Then re-propose or reject the proposals from before: octo lines. Or: ${ack(group.project)}`,
    };
  });
}

const SummaryState = z.object({
  ref: z.string(),
  repo: z.string().nullable(),
  summaryAt: z.string().nullable(),
  lastWork: z.string().nullable(),
});

/** A summary falls due this long after significant work, so that a burst of work is summed up once. */
export const SUMMARY_DUE_MS = 60 * 60 * 1000;

/**
 * Summaries stay true without anyone reading history: an hour after significant work on a working line (a plan
 * changed, an issue closed, a question asked or answered), its summary is due until the owner rewrites it. What
 * counts is decided by what happened, not by the agent.
 */
function summaryRules(ctx: Ctx): DesiredDrift[] {
  const dueBefore = new Date(Date.parse(ctx.now) - SUMMARY_DUE_MS).toISOString();
  return rows(
    ctx,
    SummaryState,
    `SELECT l.ref AS ref, (SELECT repo FROM line_repos WHERE line = l.ref ORDER BY position LIMIT 1) AS repo,
       l.summaryAt AS summaryAt,
       (SELECT MAX(e.ts) FROM events e WHERE e.line = l.ref
          AND (e.type IN ('line.plan_set', 'decision.requested', 'decision.resolved', 'decision.changed')
               OR (e.type = 'issue.status_changed' AND json_extract(e.attrs, '$.status') IN ('done', 'cancelled')))) AS lastWork
     FROM lines l WHERE l.state = 'working' AND l.ownedBy IS NULL`,
  ).flatMap((line): DesiredDrift[] => {
    if (line.lastWork === null || line.lastWork > dueBefore) return [];
    if (line.summaryAt !== null && line.summaryAt >= line.lastWork) return [];
    return [
      {
        rule: "summary-due",
        dedupeKey: `summary-due:${line.ref}`,
        fingerprint: line.summaryAt ?? "never",
        target: line.ref,
        cause: null,
        project: line.repo,
        message: `${line.ref}'s summary is due: work happened since it was last written`,
        suggestion: `octo line summarize ${line.ref} --headline "<one sentence that stands alone>" --summary-file -`,
      },
    ];
  });
}

/** Every level rule, evaluated from scratch. See docs/DESIGN.md, D6, for why this is not incremental. */
export function evaluateLevelRules(ctx: Ctx, graph: GraphSnapshot): DesiredDrift[] {
  return [
    ...prIssueRules(ctx),
    ...issueRules(ctx, graph),
    ...prRules(ctx, graph),
    ...rollupRules(ctx),
    ...lineRules(ctx),
    ...summaryRules(ctx),
  ];
}
