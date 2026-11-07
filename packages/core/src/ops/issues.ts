import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { EventAttrs, Issue, IssueStatus, Priority } from "../schemas.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { requireIssue, requireMilestone, requireProject } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { IssueRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { buildIssueCard } from "./cards.ts";
import { addLink } from "./links.ts";

export function issueAttrs(issue: Issue): EventAttrs {
  return {
    status: issue.status,
    priority: issue.priority,
    label: issue.labels,
    ...(issue.assignee === null ? {} : { assignee: issue.assignee }),
    ...(issue.milestone === null ? {} : { milestone: issue.milestone }),
  };
}

export interface CreateIssueInput {
  project: string;
  title: string;
  body?: string;
  status?: IssueStatus;
  priority?: Priority;
  assignee?: string;
  labels?: readonly string[];
  milestone?: string;
}

export function createIssue(ctx: Ctx, input: CreateIssueInput): Issue {
  const project = requireProject(ctx, input.project);
  const milestone = input.milestone === undefined ? null : requireMilestone(ctx, input.milestone);
  if (milestone !== null && milestone.project !== project.ref) {
    throw new OctoError(
      "invalid_input",
      `${milestone.ref} belongs to ${milestone.project}, not ${project.ref}`,
    );
  }
  const status = input.status ?? "todo";
  const ref = `${project.ref}-${nextNumber(ctx, `issue:${project.ref}`)}`;
  ctx.sql.run(
    `INSERT INTO issues (ref, project, title, body, status, priority, assignee, labels, milestone, version, createdAt, updatedAt, closedAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      ref,
      project.ref,
      input.title,
      input.body ?? "",
      status,
      input.priority ?? "medium",
      input.assignee ?? null,
      JSON.stringify(input.labels ?? []),
      milestone?.ref ?? null,
      ctx.now,
      ctx.now,
      status === "done" || status === "cancelled" ? ctx.now : null,
      ctx.actor,
    ],
  );
  const issue = requireIssue(ctx, ref);
  emit(ctx, {
    type: "issue.created",
    kind: "issue",
    ref,
    project: project.ref,
    summary: `${ref} created: ${input.title}`,
    attrs: issueAttrs(issue),
  });
  return issue;
}

function isClosed(status: IssueStatus): boolean {
  return status === "done" || status === "cancelled";
}

function emitIssueChange(
  ctx: Ctx,
  updated: Issue,
  changes: ReturnType<typeof applyPatch>,
  claim?: string,
): void {
  const fields = Object.keys(changes);
  if (fields.length === 0) return;
  const statusChange = changes.status;
  emit(ctx, {
    type: claim ?? (statusChange ? "issue.status_changed" : "issue.updated"),
    kind: "issue",
    ref: updated.ref,
    project: updated.project,
    summary: statusChange
      ? `${updated.ref} moved to ${updated.status}: ${updated.title}`
      : `${updated.ref} updated (${fields.join(", ")}): ${updated.title}`,
    attrs: issueAttrs(updated),
    changes,
  });
}

export const issueOps = [
  bind(contracts.issueCreate, (ctx, input) => {
    const issue = createIssue(ctx, input);
    for (const target of input.blocks ?? []) addLink(ctx, issue.ref, "blocks", target);
    for (const blocker of input.blockedBy ?? []) addLink(ctx, blocker, "blocks", issue.ref);
    for (const source of input.derivedFrom ?? []) addLink(ctx, issue.ref, "derived_from", source);
    return issue;
  }),

  bind(contracts.issueUpdate, (ctx, input) => {
    if (input.ifVersion !== undefined && input.refs.length > 1) {
      throw new OctoError("invalid_input", "ifVersion only makes sense with a single ref");
    }
    return input.refs.map((rawRef) => {
      const current = requireIssue(ctx, rawRef);
      assertVersion(current.ref, current.version, input.ifVersion);
      if (input.milestone !== undefined && input.milestone !== null) {
        const milestone = requireMilestone(ctx, input.milestone);
        if (milestone.project !== current.project) {
          throw new OctoError(
            "invalid_input",
            `${milestone.ref} belongs to ${milestone.project}, not ${current.project}`,
          );
        }
      }
      const labels =
        input.addLabels === undefined && input.removeLabels === undefined
          ? undefined
          : [...new Set([...current.labels, ...(input.addLabels ?? [])])].filter(
              (label) => !(input.removeLabels ?? []).includes(label),
            );
      const nextStatus = input.status ?? current.status;
      const closedAt =
        input.status === undefined || isClosed(nextStatus) === isClosed(current.status)
          ? undefined
          : isClosed(nextStatus)
            ? ctx.now
            : null;
      const changes = applyPatch(ctx, "issues", current.ref, current, {
        title: input.title,
        body: input.body,
        status: input.status,
        priority: input.priority,
        assignee: input.assignee,
        labels,
        milestone:
          input.milestone === undefined || input.milestone === null
            ? input.milestone
            : input.milestone.toUpperCase(),
        closedAt,
      });
      const updated = requireIssue(ctx, current.ref);
      emitIssueChange(ctx, updated, changes);
      return updated;
    });
  }),

  bind(contracts.issueList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, IssueRow, "SELECT * FROM issues ORDER BY updatedAt DESC").map((value) => ({
      kind: "issue" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => buildIssueCard(ctx, entity.value, graph));
  }),

  bind(contracts.issueClaim, (ctx, input) =>
    input.refs.map((rawRef) => {
      const current = requireIssue(ctx, rawRef);
      if (current.assignee !== null && current.assignee !== ctx.actor && input.force !== true) {
        throw new OctoError(
          "conflict",
          `${current.ref} is claimed by ${current.assignee}`,
          "Pick other work, or pass --force if that agent has gone away.",
        );
      }
      const startsWork = current.status === "todo" || current.status === "backlog";
      const changes = applyPatch(ctx, "issues", current.ref, current, {
        assignee: ctx.actor,
        status: startsWork ? "in_progress" : undefined,
      });
      const updated = requireIssue(ctx, current.ref);
      emitIssueChange(ctx, updated, changes, "issue.claimed");
      return updated;
    }),
  ),

  bind(contracts.issueRelease, (ctx, input) =>
    input.refs.map((rawRef) => {
      const current = requireIssue(ctx, rawRef);
      if (current.assignee !== null && current.assignee !== ctx.actor) {
        throw new OctoError("conflict", `${current.ref} is claimed by ${current.assignee}, not ${ctx.actor}`);
      }
      const changes = applyPatch(ctx, "issues", current.ref, current, {
        assignee: null,
        status: current.status === "in_progress" ? "todo" : undefined,
      });
      const updated = requireIssue(ctx, current.ref);
      emitIssueChange(ctx, updated, changes, "issue.released");
      return updated;
    }),
  ),
];
