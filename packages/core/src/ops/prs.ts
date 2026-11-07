import { contracts, type PrInput } from "../contracts.ts";
import { extractIssueRefs } from "../refs.ts";
import type { EventAttrs, PullRequest } from "../schemas.ts";
import { applyPatch, emit, nextNumber } from "../store/common.ts";
import { type Ctx, rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { getIssue, getPr, getPrByNumber } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { PrRow, ProjectRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { buildPrCard, comparePrCards } from "./cards.ts";
import { addLink, wasRemoved } from "./links.ts";

function prAttrs(pr: PullRequest): EventAttrs {
  return {
    status: pr.state,
    state: pr.state,
    checks: pr.checks,
    review: pr.review,
    repo: pr.repo,
    assignee: pr.author,
    alias: `${pr.repo}#${pr.number}`,
  };
}

/**
 * A monorepo can hold several projects, so an issue the PR mentions decides which one it belongs to. Without such a
 * mention, the first project on the repo is the best guess available.
 */
function projectForRepo(ctx: Ctx, repo: string, mentioned: readonly string[]): string | null {
  const candidates = rows(ctx, ProjectRow, "SELECT * FROM projects WHERE repo = ? ORDER BY ref", [repo]);
  for (const ref of mentioned) {
    const issue = getIssue(ctx, ref);
    if (issue !== null && candidates.some((project) => project.ref === issue.project)) return issue.project;
  }
  return candidates[0]?.ref ?? null;
}

function mentionsIn(input: PrInput): string[] {
  return extractIssueRefs(`${input.title} ${input.headRef ?? ""} ${input.body ?? ""}`);
}

function requirePr(ctx: Ctx, repo: string, number: number): PullRequest {
  const pr = getPrByNumber(ctx, repo, number);
  if (pr === null) throw new Error(`PR ${repo}#${number} vanished during upsert`);
  return pr;
}

function insertPr(ctx: Ctx, input: PrInput): PullRequest {
  const ref = `PR-${nextNumber(ctx, "pr")}`;
  ctx.sql.run(
    `INSERT INTO prs (ref, repo, number, project, title, body, url, state, checks, review, mergeable, headRef, baseRef, headSha, author, additions, deletions, mergedAt, closedAt, version, createdAt, updatedAt, syncedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      ref,
      input.repo,
      input.number,
      projectForRepo(ctx, input.repo, [...(input.issues ?? []), ...mentionsIn(input)]),
      input.title,
      input.body ?? "",
      input.url ?? `https://github.com/${input.repo}/pull/${input.number}`,
      input.state,
      input.checks ?? "none",
      input.review ?? "none",
      input.mergeable ?? "unknown",
      input.headRef ?? "",
      input.baseRef ?? "",
      input.headSha ?? "",
      input.author ?? ctx.actor,
      input.additions ?? 0,
      input.deletions ?? 0,
      input.mergedAt ?? null,
      input.closedAt ?? null,
      ctx.now,
      ctx.now,
      ctx.now,
    ],
  );
  return requirePr(ctx, input.repo, input.number);
}

/** The most significant thing that happened, so that one sync produces one meaningful feed entry. */
function changeHeadline(
  pr: PullRequest,
  fields: readonly string[],
  fromState: unknown,
): { type: string; summary: string } {
  const label = `${pr.ref} (${pr.repo}#${pr.number})`;
  if (fields.includes("state")) {
    if (pr.state === "merged") return { type: "pr.merged", summary: `${label} merged: ${pr.title}` };
    if (pr.state === "closed")
      return { type: "pr.closed", summary: `${label} closed without merging: ${pr.title}` };
    if (fromState === "draft")
      return { type: "pr.ready", summary: `${label} is ready for review: ${pr.title}` };
    return { type: "pr.reopened", summary: `${label} is now ${pr.state}: ${pr.title}` };
  }
  if (fields.includes("checks")) {
    return { type: "pr.checks_changed", summary: `${label} checks ${pr.checks}: ${pr.title}` };
  }
  if (fields.includes("review")) {
    return {
      type: "pr.review_changed",
      summary: `${label} review ${pr.review.replace("_", " ")}: ${pr.title}`,
    };
  }
  return { type: "pr.updated", summary: `${label} updated (${fields.join(", ")}): ${pr.title}` };
}

function upsertPr(ctx: Ctx, input: PrInput): { pr: PullRequest; changed: boolean } {
  const existing = getPrByNumber(ctx, input.repo, input.number);
  let pr: PullRequest;
  let changed = false;
  if (existing === null) {
    pr = insertPr(ctx, input);
    changed = true;
    // A PR first seen after it finished must still count as merged or closed, or a watcher would never hear of it.
    const label = `${pr.ref} (${pr.repo}#${pr.number})`;
    const first =
      pr.state === "merged"
        ? { type: "pr.merged", summary: `${label} merged: ${pr.title}` }
        : pr.state === "closed"
          ? { type: "pr.closed", summary: `${label} closed without merging: ${pr.title}` }
          : { type: "pr.opened", summary: `${label} opened: ${pr.title}` };
    emit(ctx, {
      ...first,
      kind: "pr",
      ref: pr.ref,
      project: pr.project,
      attrs: prAttrs(pr),
      // Counts as changes from nothing, so that `to:merged` also matches a PR first seen once it had merged.
      changes: {
        state: { from: null, to: pr.state },
        checks: { from: null, to: pr.checks },
        review: { from: null, to: pr.review },
      },
    });
  } else {
    const changes = applyPatch(ctx, "prs", existing.ref, existing, {
      title: input.title,
      body: input.body,
      url: input.url,
      state: input.state,
      checks: input.checks,
      review: input.review,
      mergeable: input.mergeable,
      headRef: input.headRef,
      baseRef: input.baseRef,
      headSha: input.headSha,
      author: input.author,
      additions: input.additions,
      deletions: input.deletions,
      mergedAt: input.mergedAt,
      closedAt: input.closedAt,
      project:
        existing.project === null
          ? (projectForRepo(ctx, input.repo, [...(input.issues ?? []), ...mentionsIn(input)]) ?? undefined)
          : undefined,
    });
    pr = getPr(ctx, existing.ref) ?? existing;
    const fields = Object.keys(changes);
    if (fields.length > 0) {
      changed = true;
      const headline = changeHeadline(pr, fields, changes.state?.from);
      emit(ctx, {
        type: headline.type,
        kind: "pr",
        ref: pr.ref,
        project: pr.project,
        summary: headline.summary,
        attrs: prAttrs(pr),
        changes,
      });
    }
  }
  ctx.sql.run("UPDATE prs SET syncedAt = ? WHERE ref = ?", [ctx.now, pr.ref]);

  const mentioned = extractIssueRefs(`${pr.title} ${pr.headRef} ${pr.body}`);
  for (const issueRef of new Set([...(input.issues ?? []), ...mentioned])) {
    if (input.issues?.includes(issueRef)) {
      addLink(ctx, pr.ref, "implements", issueRef);
      continue;
    }
    // Text that merely looks like a ref, such as "UTF-8", must not fail a sync, and a link someone removed on purpose
    // must not come back just because the text still mentions the issue.
    if (getIssue(ctx, issueRef) !== null && !wasRemoved(ctx, pr.ref, "implements", issueRef)) {
      addLink(ctx, pr.ref, "implements", issueRef);
    }
  }
  return { pr: getPr(ctx, pr.ref) ?? pr, changed };
}

export const prOps = [
  bind(contracts.prUpsert, (ctx, input) => upsertPr(ctx, input).pr),

  bind(contracts.prSync, (ctx, input) => {
    for (const repo of input.repos ?? []) {
      ctx.sql.run(
        `INSERT INTO github_sync (repo, lastOkAt, error, updatedAt) VALUES (?, ?, NULL, ?)
         ON CONFLICT(repo) DO UPDATE SET lastOkAt = excluded.lastOkAt, error = NULL, updatedAt = excluded.updatedAt`,
        [repo, ctx.now, ctx.now],
      );
    }
    for (const failure of input.failures ?? []) {
      ctx.sql.run(
        `INSERT INTO github_sync (repo, error, updatedAt) VALUES (?, ?, ?)
         ON CONFLICT(repo) DO UPDATE SET error = excluded.error, updatedAt = excluded.updatedAt`,
        [failure.repo, failure.error, ctx.now],
      );
    }
    const changed: string[] = [];
    for (const item of input.prs) {
      const result = upsertPr(ctx, item);
      if (result.changed) changed.push(result.pr.ref);
    }
    return { synced: input.prs.length, changed };
  }),

  bind(contracts.prList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, PrRow, "SELECT * FROM prs").map((value) => ({ kind: "pr" as const, value }));
    return filterEntities(ctx, all, input.query, graph)
      .map((entity) => buildPrCard(ctx, entity.value, graph))
      .sort(comparePrCards)
      .slice(0, input.limit ?? 200);
  }),
];
