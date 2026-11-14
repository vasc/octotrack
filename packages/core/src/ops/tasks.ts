import { z } from "zod";
import { guardLineWrite } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { HeldItem, Issue, Place } from "../schemas.ts";
import { claimOf } from "../store/agents.ts";
import { applyPatch, emit } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { findEntity, requireIssue, requireLine } from "../store/entities.ts";
import { addToInbox } from "../store/inbox.ts";
import { DecisionRow, IssueRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloper } from "./developer.ts";
import { createIssue } from "./issues.ts";
import { addLink } from "./links.ts";

/** Held work is trusted for this long after it was asked or re-confirmed. */
export const HELD_CURRENT_MS = 7 * 24 * 60 * 60 * 1000;

const PlaceRow = z.object({ name: z.string(), position: z.number().int() });
const ToRow = z.object({ toRef: z.string() });

function places(ctx: Ctx): Place[] {
  return rows(ctx, PlaceRow, "SELECT * FROM places ORDER BY position");
}

function requirePlace(ctx: Ctx, name: string): string {
  const list = places(ctx);
  const found = list.find((place) => place.name.toLowerCase() === name.trim().toLowerCase());
  if (found !== undefined) return found.name;
  throw new OctoError(
    "invalid_input",
    `"${name}" is not one of the developer's places`,
    list.length === 0
      ? "The developer has no places yet; they add them with octo place add."
      : `Use one of: ${list.map((place) => place.name).join(", ")}.`,
  );
}

function requireTask(ctx: Ctx, ref: string): Issue {
  const issue = requireIssue(ctx, ref);
  if (issue.assignee !== DEVELOPER || issue.outcome === null) {
    throw new OctoError("invalid_input", `${issue.ref} is not a task for the developer`);
  }
  if (issue.status === "done" || issue.status === "cancelled") {
    throw new OctoError("conflict", `${issue.ref} is already ${issue.status === "done" ? "done" : "closed"}`);
  }
  return issue;
}

/** The issue a task frees: the one it blocks. */
function freedBy(ctx: Ctx, task: string): string | null {
  return (
    one(
      ctx,
      ToRow,
      "SELECT l.toRef FROM links l JOIN issues i ON i.ref = l.toRef WHERE l.fromRef = ? AND l.rel = 'blocks' LIMIT 1",
      [task],
    )?.toRef ?? null
  );
}

function closeTask(ctx: Ctx, task: Issue, status: "done" | "cancelled", result: string): Issue {
  const changes = applyPatch(ctx, "issues", task.ref, task, { status, result, closedAt: ctx.now });
  const kind = status === "done" ? "task_done" : "task_cant";
  const frees = freedBy(ctx, task.ref);
  if (task.line !== null) {
    addToInbox(
      ctx,
      task.line,
      kind,
      task.ref,
      frees,
      status === "done"
        ? `${task.ref} done: ${result} ("${task.title}")`
        : `${task.ref} could not be done: ${result} ("${task.title}")`,
    );
  }
  emit(ctx, {
    type: status === "done" ? "task.done" : "task.cant",
    kind: "issue",
    ref: task.ref,
    project: task.project,
    line: task.line,
    summary: status === "done" ? `${task.ref} done: ${result}` : `${task.ref} could not be done: ${result}`,
    attrs: { status },
    changes,
  });
  return requireIssue(ctx, task.ref);
}

function isCurrent(since: string, now: string): boolean {
  return Date.parse(now) - Date.parse(since) <= HELD_CURRENT_MS;
}

/** Questions and tasks on a line, with whether each is still trusted. */
export function heldOn(ctx: Ctx, line: string): HeldItem[] {
  const questions = rows(
    ctx,
    DecisionRow,
    "SELECT * FROM decisions WHERE line = ? AND status = 'open' ORDER BY createdAt",
    [line],
  ).map((decision): HeldItem => {
    const since = decision.confirmedAt ?? decision.createdAt;
    return {
      ref: decision.ref,
      kind: "question",
      title: decision.title,
      line,
      current: isCurrent(since, ctx.now),
      since,
    };
  });
  const tasks = rows(
    ctx,
    IssueRow,
    "SELECT * FROM issues WHERE line = ? AND assignee = ? AND outcome IS NOT NULL AND status NOT IN ('done', 'cancelled') ORDER BY createdAt",
    [line, DEVELOPER],
  ).map((issue): HeldItem => {
    const since = issue.confirmedAt ?? issue.createdAt;
    return {
      ref: issue.ref,
      kind: "task",
      title: issue.title,
      line,
      current: isCurrent(since, ctx.now),
      since,
    };
  });
  return [...questions, ...tasks];
}

export const taskOps = [
  bind(contracts.taskFile, (ctx, input) => {
    const lineRef = input.line ?? (ctx.developer ? null : (claimOf(ctx, ctx.actor)?.line ?? null));
    if (lineRef === null) {
      throw new OctoError("invalid_input", "A task waits on a line", "Take a line first, or pass --line.");
    }
    const line = requireLine(ctx, lineRef);
    guardLineWrite(ctx, line.ref, "scope");
    const place = requirePlace(ctx, input.place);
    const frees =
      input.frees === undefined
        ? (rows(
            ctx,
            IssueRow,
            "SELECT * FROM issues WHERE line = ? AND assignee = ? AND status NOT IN ('done', 'cancelled') ORDER BY updatedAt DESC LIMIT 1",
            [line.ref, ctx.actor],
          )[0] ?? null)
        : requireIssue(ctx, input.frees);
    const project = frees?.project ?? line.repos[0];
    if (project === undefined) {
      throw new OctoError(
        "invalid_input",
        `${line.ref} has no repo to file the task in`,
        "Pass --frees <REF>.",
      );
    }
    const task = createIssue(ctx, {
      project,
      title: input.title,
      ...(input.body === undefined ? {} : { body: input.body }),
      assignee: DEVELOPER,
      line: line.ref,
    });
    ctx.sql.run("UPDATE issues SET place = ?, outcome = ? WHERE ref = ?", [place, input.outcome, task.ref]);
    if (frees !== null) addLink(ctx, task.ref, "blocks", frees.ref);
    return requireIssue(ctx, task.ref);
  }),

  bind(contracts.taskDone, (ctx, input) => {
    requireDeveloper(ctx, "finish a task");
    return closeTask(ctx, requireTask(ctx, input.ref), "done", input.result);
  }),

  bind(contracts.taskCant, (ctx, input) => {
    requireDeveloper(ctx, "say a task cannot be done");
    return closeTask(ctx, requireTask(ctx, input.ref), "cancelled", input.why);
  }),

  bind(contracts.placeList, (ctx) => places(ctx)),

  bind(contracts.placeAdd, (ctx, input) => {
    requireDeveloper(ctx, "add a place");
    const exists = places(ctx).some((place) => place.name.toLowerCase() === input.name.toLowerCase());
    if (!exists) {
      ctx.sql.run(
        "INSERT INTO places (name, position) VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM places))",
        [input.name],
      );
      ctx.visibleChange = true;
    }
    return places(ctx);
  }),

  bind(contracts.placeRemove, (ctx, input) => {
    requireDeveloper(ctx, "remove a place");
    ctx.sql.run("DELETE FROM places WHERE lower(name) = lower(?)", [input.name]);
    ctx.visibleChange = true;
    return places(ctx);
  }),

  bind(contracts.heldList, (ctx, input) => heldOn(ctx, requireLine(ctx, input.line).ref)),

  bind(contracts.heldConfirm, (ctx, input) => {
    const lines = new Set<string>();
    for (const ref of input.refs) {
      const entity = findEntity(ctx, ref);
      if (
        entity === null ||
        (entity.kind !== "decision" && entity.kind !== "issue") ||
        entity.value.line === null
      ) {
        throw new OctoError("invalid_input", `${ref} is not a question or task on a line`);
      }
      guardLineWrite(ctx, entity.value.line, "scope");
      ctx.sql.run(
        `UPDATE ${entity.kind === "decision" ? "decisions" : "issues"} SET confirmedAt = ? WHERE ref = ?`,
        [ctx.now, entity.value.ref],
      );
      lines.add(entity.value.line);
    }
    ctx.visibleChange = true;
    return [...lines].flatMap((line) => heldOn(ctx, line)).filter((item) => input.refs.includes(item.ref));
  }),
];
