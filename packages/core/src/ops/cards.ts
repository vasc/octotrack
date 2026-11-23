import type { Issue, IssueCard, PrCard, ProjectCard, PullRequest, Project } from "../schemas.ts";
import { countOf } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import type { GraphSnapshot } from "../store/graph.ts";

function openDriftCount(ctx: Ctx, ref: string): number {
  return countOf(ctx, "SELECT COUNT(*) AS n FROM drifts WHERE target = ? AND status = 'open'", [ref]);
}

export function prAttention(pr: PullRequest): string[] {
  if (pr.state === "merged" || pr.state === "closed") return [];
  const attention: string[] = [];
  if (pr.checks === "failing") attention.push("checks failing");
  if (pr.mergeable === "conflicting") attention.push("merge conflict");
  if (pr.review === "changes_requested") attention.push("changes requested");
  if (pr.state === "open" && pr.review === "requested") attention.push("needs review");
  if (
    pr.state === "open" &&
    pr.review === "approved" &&
    (pr.checks === "passing" || pr.checks === "none") &&
    pr.mergeable !== "conflicting"
  ) {
    attention.push("ready to merge");
  }
  return attention;
}

export function buildPrCard(ctx: Ctx, pr: PullRequest, graph: GraphSnapshot): PrCard {
  return {
    pr,
    issues: graph.from(pr.ref, "implements"),
    attention: prAttention(pr),
    openDrift: openDriftCount(ctx, pr.ref),
  };
}

const STATE_ORDER: Readonly<Record<PullRequest["state"], number>> = {
  open: 0,
  draft: 1,
  merged: 2,
  closed: 3,
};

/** Problems first, then what can be merged, then everything else by recency. */
export function comparePrCards(a: PrCard, b: PrCard): number {
  const rank = (card: PrCard): number => {
    if (card.attention.some((item) => item !== "ready to merge" && item !== "needs review")) return 0;
    if (card.attention.includes("ready to merge")) return 1;
    if (card.attention.includes("needs review")) return 2;
    return 3;
  };
  return (
    STATE_ORDER[a.pr.state] - STATE_ORDER[b.pr.state] ||
    rank(a) - rank(b) ||
    b.pr.updatedAt.localeCompare(a.pr.updatedAt)
  );
}

export function buildIssueCard(ctx: Ctx, issue: Issue, graph: GraphSnapshot): IssueCard {
  return {
    issue,
    blockedBy: graph.openBlockersOf(issue.ref),
    blocking: graph.blocking(issue.ref),
    prs: graph.to(issue.ref, "implements"),
    openDrift: openDriftCount(ctx, issue.ref),
  };
}

export function buildProjectCard(ctx: Ctx, project: Project, graph: GraphSnapshot): ProjectCard {
  const scope = [project.ref];
  const issueRefs = graph.open;
  const total = countOf(ctx, "SELECT COUNT(*) AS n FROM issues WHERE project = ?", scope);
  const closed = countOf(
    ctx,
    "SELECT COUNT(*) AS n FROM issues WHERE project = ? AND status IN ('done', 'cancelled')",
    scope,
  );
  const active = countOf(
    ctx,
    "SELECT COUNT(*) AS n FROM issues WHERE project = ? AND status IN ('in_progress', 'in_review')",
    scope,
  );
  const blockerTargets = new Set(
    graph.links
      .filter((link) => link.rel === "blocks" && issueRefs.has(link.fromRef))
      .map((link) => link.toRef),
  );
  const prefix = `${project.ref}-`;
  const blockedByLink = [...blockerTargets].filter((ref) => ref.startsWith(prefix) && issueRefs.has(ref));
  const markedBlocked = countOf(
    ctx,
    "SELECT COUNT(*) AS n FROM issues WHERE project = ? AND status = 'blocked'",
    scope,
  );
  return {
    project,
    stats: {
      issuesTotal: total,
      issuesClosed: closed,
      issuesActive: active,
      issuesBlocked: Math.max(blockedByLink.length, markedBlocked),
      openDecisions: countOf(
        ctx,
        "SELECT COUNT(*) AS n FROM decisions WHERE project = ? AND status = 'open'",
        scope,
      ),
      openPrs: countOf(
        ctx,
        "SELECT COUNT(*) AS n FROM prs WHERE project = ? AND state IN ('open', 'draft')",
        scope,
      ),
      openDrift: countOf(
        ctx,
        "SELECT COUNT(*) AS n FROM drifts WHERE project = ? AND status = 'open'",
        scope,
      ),
    },
  };
}
