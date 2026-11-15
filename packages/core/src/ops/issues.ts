import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { EventAttrs, Issue, IssueStatus, Priority } from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import {
  requireEntity,
  requireIssue,
  requireLine,
  requireMilestone,
  requireProject,
  resolveRef,
} from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { IssueRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { buildIssueCard } from "./cards.ts";
import { guardLineWrite, guardOnLine } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import { claimOf, getAgent } from "../store/agents.ts";
import { checkStep } from "./lines.ts";
import { addLink, guardEnds } from "./links.ts";

export function issueAttrs(issue: Issue): EventAttrs {
  return {
    status: issue.status,
    priority: issue.priority,
    label: issue.labels,
    ...(issue.assignee === null ? {} : { assignee: issue.assignee }),
    ...(issue.milestone === null ? {} : { milestone: issue.milestone }),
    ...(issue.line === null ? {} : { line: issue.line }),
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
  line?: string;
  step?: number;
}

/**
 * Files an issue. `forDeveloper` is for the developer's own operations, which an agent may relay with --said: the issue
 * is then the developer's, on a line of theirs no agent may otherwise write to.
 */
export function createIssue(ctx: Ctx, input: CreateIssueInput, forDeveloper = false): Issue {
  const project = requireProject(ctx, input.project);
  const milestone = input.milestone === undefined ? null : requireMilestone(ctx, input.milestone);
  if (milestone !== null && milestone.project !== project.ref) {
    throw new OctoError(
      "invalid_input",
      `${milestone.ref} belongs to ${milestone.project}, not ${project.ref}`,
    );
  }
  const line = input.line === undefined ? null : requireLine(ctx, input.line).ref;
  const work = isWork(input.status, input.assignee);
  // Filing on a line is writing to it: only from that line (D13).
  if (!forDeveloper) guardOnLine(ctx, line, work ? "work" : "scope", null);
  checkStep(ctx, line, input.step ?? null);
  const status = input.status ?? "todo";
  const ref = `${project.ref}-${nextNumber(ctx, `issue:${project.ref}`)}`;
  if (work && !forDeveloper) requireOnLine(ctx, { ref, line, project: project.ref });
  ctx.sql.run(
    `INSERT INTO issues (ref, project, title, body, status, priority, assignee, labels, milestone, line, step, version, createdAt, updatedAt, closedAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
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
      line,
      input.step ?? null,
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
    line,
    summary: `${ref} created: ${input.title}`,
    attrs: issueAttrs(issue),
  });
  return issue;
}

/** Claiming, progressing or finishing an issue is work; filing and describing it is scoping. */
function isWork(status: IssueStatus | undefined, assignee: string | null | undefined): boolean {
  return (
    (status !== undefined && status !== "todo" && status !== "backlog" && status !== "blocked") ||
    // Filing a task for the developer is scoping; giving an agent an issue is work.
    (assignee !== undefined && assignee !== null && assignee !== DEVELOPER)
  );
}

/**
 * An agent claims, progresses and finishes issues only on the line it is on: an owner in any repo the line names, a
 * helper in its own.
 */
function requireOnLine(ctx: Ctx, issue: { ref: string; line: string | null; project: string }): void {
  if (issue.line === null || ctx.developer || ctx.system) return;
  const claim = claimOf(ctx, ctx.actor);
  const hint = `Take the line first: octo line take ${issue.line}`;
  if (claim === null || claim.line !== issue.line) {
    throw new OctoError("forbidden", `${issue.ref} is on ${issue.line}, which you are not on`, hint);
  }
  if (claim.role === "helper" && getAgent(ctx, ctx.actor)?.repo !== issue.project) {
    throw new OctoError(
      "forbidden",
      `As a helper you claim issues in your own repo only; ${issue.ref} is in ${issue.project}`,
      "Ask the line's owner, or take an issue in your repo.",
    );
  }
}

function isClosed(status: IssueStatus): boolean {
  return status === "done" || status === "cancelled";
}

/**
 * An open task is the developer's: they finish it with Done or Can't do it, which report back through the line's inbox.
 * An agent closing, reopening or taking it through the generic issue operations would skip that report and take it out
 * of the developer's to do; it withdraws a task that no longer stands instead. A closed task stays closed: reopening it
 * would put it back in to do with its old result, so a new need is a new task (fifth audit, B12).
 */
function guardTask(ctx: Ctx, issue: Issue, change: { status?: IssueStatus; assignee?: string | null }): void {
  if (ctx.developer || ctx.system) return;
  if (issue.assignee !== DEVELOPER || issue.outcome === null) return;
  const moves = change.status !== undefined && change.status !== issue.status;
  const reassigns = change.assignee !== undefined && change.assignee !== issue.assignee;
  if (!moves && !reassigns) return;
  if (isClosed(issue.status)) {
    throw new OctoError(
      "forbidden",
      `${issue.ref} is a task the developer closed: it is not reopened or taken`,
      `If it is needed again, file a new task: octo task file "<what>" --place "<where>" --outcome "<what to send back>".`,
    );
  }
  throw new OctoError(
    "forbidden",
    `${issue.ref} is a task for the developer: only they finish it, or say it cannot be done`,
    `If it no longer stands, withdraw it: octo held withdraw ${issue.ref} --why "<why>". If the developer told you it is done, relay it: octo task done ${issue.ref} --said "<their words>".`,
  );
}

function emitIssueChange(
  ctx: Ctx,
  updated: Issue,
  changes: ReturnType<typeof applyPatch>,
  claim?: EventTypeName,
): void {
  const fields = Object.keys(changes);
  if (fields.length === 0) return;
  const statusChange = changes.status;
  emit(ctx, {
    type: claim ?? (statusChange ? "issue.status_changed" : "issue.updated"),
    kind: "issue",
    ref: updated.ref,
    project: updated.project,
    line: updated.line,
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
    // What it blocks, or is blocked by, is changed too: only on the line the agent is on, or on no line.
    const created = requireEntity(ctx, issue.ref);
    for (const other of [...(input.blocks ?? []), ...(input.blockedBy ?? []), ...(input.derivedFrom ?? [])]) {
      guardEnds(ctx, created, resolveRef(ctx, other));
    }
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
      guardTask(ctx, current, input);
      if (input.milestone !== undefined && input.milestone !== null) {
        const milestone = requireMilestone(ctx, input.milestone);
        if (milestone.project !== current.project) {
          throw new OctoError(
            "invalid_input",
            `${milestone.ref} belongs to ${milestone.project}, not ${current.project}`,
          );
        }
      }
      const line =
        input.line === undefined || input.line === null ? input.line : requireLine(ctx, input.line).ref;
      const nextLine = line === undefined ? current.line : line;
      const kind = isWork(input.status, input.assignee) ? "work" : "scope";
      // Rewriting an issue, or moving it on or off a line, is writing to the line it leaves and the one it joins.
      guardOnLine(ctx, current.line, kind, current.ref);
      if (nextLine !== current.line) guardOnLine(ctx, nextLine, kind, current.ref);
      // Giving an issue to someone, or taking it away, is claiming it, as much as moving it on is.
      const reassigns = input.assignee !== undefined && input.assignee !== current.assignee;
      if (kind === "work" || reassigns) {
        requireOnLine(ctx, current);
        if (nextLine !== current.line) requireOnLine(ctx, { ...current, line: nextLine });
      }
      const step = line === null ? null : input.step;
      checkStep(ctx, nextLine, step === undefined ? current.step : step);
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
        line,
        step,
      });
      const updated = requireIssue(ctx, current.ref);
      // Put on a line again, it is no longer work that was turned down as not a line.
      if (updated.line !== null) ctx.sql.run("DELETE FROM not_a_line WHERE issue = ?", [updated.ref]);
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
      guardTask(ctx, current, { assignee: ctx.actor });
      guardLineWrite(ctx, current.line, "work");
      requireOnLine(ctx, current);
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
      // Releasing one's own claim is always one's own business; moving unclaimed work back to todo is work on its line.
      if (current.assignee === null) guardOnLine(ctx, current.line, "work", current.ref);
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
