import { z } from "zod";
import { holdsWork } from "../agents/claims.ts";
import { HELD_CURRENT_MS } from "../agents/held.ts";
import { DEVELOPER } from "../agents/state.ts";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import type { AtView, Decision, HeldItem, Issue, Place } from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { onlyLineOf } from "../store/agents.ts";
import { applyPatch, emit } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { allLines, findEntity, requireIssue, requireLine } from "../store/entities.ts";
import { addToInbox } from "../store/inbox.ts";
import { DecisionRow, IssueRow } from "../store/rows.ts";
import { bind } from "./bind.ts";
import { requireDeveloperInPerson } from "./developer.ts";
import { withdrawQuestion } from "./decisions.ts";
import { createIssue } from "./issues.ts";
import { addLink } from "./links.ts";

const PlaceRow = z.object({ name: z.string(), position: z.number().int() });
const ToRow = z.object({ toRef: z.string() });

function places(ctx: Ctx): Place[] {
  return rows(ctx, PlaceRow, "SELECT * FROM places ORDER BY position");
}

/** A place added or removed is in the log, so one made on the developer's quoted words shows whose words they were. */
function emitPlace(ctx: Ctx, type: EventTypeName, name: string, summary: string): void {
  emit(ctx, { type, kind: "place", ref: name, project: null, summary });
}

/** A task's place, if it names one: blank words name none, so no nameless place is ever added. */
function placeOf(ctx: Ctx, name: string | undefined): string | null {
  return name === undefined || name.trim() === "" ? null : requirePlace(ctx, name);
}

/** A place by its name; one not on the list yet is added to it, as the developer would with octo place add. */
function requirePlace(ctx: Ctx, name: string): string {
  const wanted = name.trim();
  const found = places(ctx).find((place) => place.name.toLowerCase() === wanted.toLowerCase());
  if (found !== undefined) return found.name;
  addPlace(ctx, wanted);
  return wanted;
}

function addPlace(ctx: Ctx, name: string): void {
  ctx.sql.run(
    "INSERT INTO places (name, position) VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM places))",
    [name],
  );
  emitPlace(ctx, "place.added", name, `${name} added to the places`);
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
/** The issue a task frees, by ref and title, for home to name beside the task. */
export function freedIssue(ctx: Ctx, task: string): { ref: string; title: string } | null {
  const ref = freedBy(ctx, task);
  return ref === null ? null : { ref, title: requireIssue(ctx, ref).title };
}

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

const LINE_BREAK = /[\r\n]/;

/** Text said on one line, as the line's inbox and the log say a task's outcome. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * A task's names, as given: each one line, with no = (the CLI answers `--value Name=value`) and no : (the outcome reads
 * "Name: value"), so a name can be answered and read as one row; refused when two differ only in case, since each is a
 * box of its own.
 */
function distinctFields(fields: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const field of fields) {
    if (LINE_BREAK.test(field) || field.includes("=") || field.includes(":")) {
      throw new OctoError(
        "invalid_input",
        `"${oneLine(field)}" must be one line, with no = or :`,
        "Name each outcome with a short label, such as Length: it is answered as --value Length=41.",
      );
    }
    const key = field.toLowerCase();
    if (seen.has(key))
      throw new OctoError("invalid_input", `"${field}" is named twice`, "Give each outcome its own name.");
    seen.add(key);
  }
  return [...fields];
}

/** The values Done gives, under the task's own names, matched whatever their case, as names are told apart. */
function valuesByName(task: Issue, values: Readonly<Record<string, string>>): Map<string, string> {
  const named = new Map<string, string>();
  for (const [given, value] of Object.entries(values)) {
    const name = task.fields.find((field) => field.toLowerCase() === given.trim().toLowerCase());
    if (name === undefined) {
      throw new OctoError(
        "invalid_input",
        `${task.ref} asks for no ${given}`,
        `It asks for: ${task.fields.join(", ")}.`,
      );
    }
    if (named.has(name)) throw new OctoError("invalid_input", `${task.ref}'s ${name} is given twice`);
    const trimmed = value.trim();
    // Each value is one row of the list: a line break in one would read as rows of its own.
    if (LINE_BREAK.test(trimmed)) {
      throw new OctoError(
        "invalid_input",
        `${task.ref}'s ${name} must be one line`,
        "Put anything longer in the note beside the values.",
      );
    }
    named.set(name, trimmed);
  }
  return named;
}

/**
 * What Done reports: a task's named outcomes as a list, each filled, then any note; or, with none named, its words. The
 * developer's own task has nothing to send anyone, so it is done without words. `said` is the same on one line, for the
 * line's inbox and the log.
 */
function outcomeOf(
  task: Issue,
  values: Readonly<Record<string, string>>,
  note: string | null,
): { result: string; said: string } {
  if (task.fields.length === 0) {
    if (note === null) {
      if (task.outcome === "") return { result: "Done", said: "Done" };
      throw new OctoError("invalid_input", `${task.ref} needs what you found`, "Pass the outcome.");
    }
    return { result: note, said: oneLine(note) };
  }
  const named = valuesByName(task, values);
  const missing = task.fields.filter((name) => (named.get(name) ?? "") === "");
  if (missing.length > 0) {
    throw new OctoError(
      "invalid_input",
      `${task.ref} still needs: ${missing.join(", ")}`,
      "Fill every named outcome.",
    );
  }
  const filled = task.fields.map((name) => `${name}: ${named.get(name) ?? ""}`);
  return {
    result: [filled.map((line) => `- ${line}`).join("\n"), ...(note === null ? [] : [note])].join("\n\n"),
    said: [...filled, ...(note === null ? [] : [oneLine(note)])].join("; "),
  };
}

/**
 * How a task closes: Done and Can't do it are the developer's, and go to whoever holds the issue it frees; withdrawn is
 * an agent saying it no longer stands, which tells nobody anything they did not already know.
 */
type TaskEnd = "done" | "cant" | "withdrawn";

function closeTask(ctx: Ctx, task: Issue, end: TaskEnd, result: string, outcome: string = result): Issue {
  // The line's inbox and the log say it on one line.
  const said = oneLine(outcome);
  const status = end === "done" ? "done" : "cancelled";
  const changes = applyPatch(ctx, "issues", task.ref, task, { status, result, closedAt: ctx.now });
  // The half-written outcome, and any half-written reason it cannot be done, are answered now.
  ctx.sql.run("DELETE FROM drafts WHERE key IN (?, ?)", [`task:${task.ref}`, `task-why:${task.ref}`]);
  const frees = freedBy(ctx, task.ref);
  if (task.line !== null && end !== "withdrawn") {
    addToInbox(
      ctx,
      task.line,
      end === "done" ? "task_done" : "task_cant",
      task.ref,
      frees,
      end === "done"
        ? `${task.ref} done: ${said} ("${task.title}")`
        : `${task.ref} could not be done: ${said} ("${task.title}")`,
    );
  }
  emit(ctx, {
    type: end === "done" ? "task.done" : end === "cant" ? "task.cant" : "task.withdrawn",
    kind: "issue",
    ref: task.ref,
    project: task.project,
    line: task.line,
    summary:
      end === "done"
        ? `${task.ref} done: ${said}`
        : end === "cant"
          ? `${task.ref} could not be done: ${said}`
          : `${task.ref} withdrawn by ${ctx.actor}: ${said}`,
    attrs: { status },
    changes,
  });
  return requireIssue(ctx, task.ref);
}

/** I'm at a place lasts this long, then ends by itself: being at the bench is an afternoon, not a setting. */
const AT_LASTS_MS = 3 * 60 * 60 * 1000;
/** Issues on a developer's line with no repo go in one project of their own. */
const OWN_PROJECT = "ME";

function ownProject(ctx: Ctx): string {
  ctx.sql.run(
    `INSERT OR IGNORE INTO projects (ref, name, description, status, repo, horizon, targetDate, version, createdAt, updatedAt, createdBy)
     VALUES (?, ?, ?, 'active', NULL, 'none', NULL, 1, ?, ?, ?)`,
    [OWN_PROJECT, "Mine", "The developer's own work, on lines with no repo", ctx.now, ctx.now, ctx.actor],
  );
  return OWN_PROJECT;
}

const AtRow = z.object({ place: z.string(), until: z.string() });

/**
 * Where the developer is, if they said so lately, with that place's tasks: open ones on working lines, and current held
 * ones on up-next lines, which can be done while there. Never tabled lines'. In the developer's order.
 */
export function atView(ctx: Ctx): AtView | null {
  const at = one(ctx, AtRow, "SELECT place, until FROM developer_at WHERE id = 1");
  if (at === null || at.until <= ctx.now) return null;
  const order = new Map(
    allLines(ctx).map((line, index) => [line.ref, { index, state: line.state }] as const),
  );
  const tasks = rows(
    ctx,
    IssueRow,
    `SELECT * FROM issues WHERE assignee = ? AND place = ? AND outcome IS NOT NULL AND status NOT IN ('done', 'cancelled')
       AND line IS NOT NULL ORDER BY createdAt`,
    [DEVELOPER, at.place],
  ).filter((task) => {
    const line = task.line === null ? undefined : order.get(task.line);
    if (line === undefined) return false;
    if (line.state === "working") return task.heldAt === null;
    return line.state === "up_next" && isCurrent(task.confirmedAt ?? task.createdAt, ctx.now);
  });
  const rank = (task: Issue) => (task.line === null ? 0 : (order.get(task.line)?.index ?? 0));
  const working = (task: Issue) => (task.line === null ? false : order.get(task.line)?.state === "working");
  tasks.sort((a, b) => Number(working(b)) - Number(working(a)) || rank(a) - rank(b));
  return { place: at.place, until: at.until, tasks };
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

/** How many of a line's questions and tasks are held for an agent now, current or not. */
export function heldCount(ctx: Ctx, line: string): { questions: number; tasks: number } {
  const count = (sql: string, params: readonly string[]) =>
    one(ctx, z.object({ n: z.number() }), sql, params)?.n ?? 0;
  return {
    questions: count(
      "SELECT COUNT(*) AS n FROM decisions WHERE line = ? AND status = 'open' AND heldAt IS NOT NULL",
      [line],
    ),
    tasks: count(
      `SELECT COUNT(*) AS n FROM issues WHERE line = ? AND assignee = ? AND outcome IS NOT NULL
         AND status NOT IN ('done', 'cancelled') AND heldAt IS NOT NULL`,
      [line, DEVELOPER],
    ),
  };
}

/**
 * The questions and tasks on a line that wait to be re-confirmed: held, and not asked or re-confirmed in the last 7
 * days. A line being worked on keeps such work held until an agent re-confirms it; one up next holds all its work.
 */
export function staleHeldOn(ctx: Ctx, line: string): string[] {
  const since = new Date(Date.parse(ctx.now) - HELD_CURRENT_MS).toISOString();
  const refs = (sql: string, params: readonly string[]) =>
    rows(ctx, z.object({ ref: z.string() }), sql, params).map((row) => row.ref);
  return [
    ...refs(
      `SELECT ref FROM decisions WHERE line = ? AND status = 'open' AND heldAt IS NOT NULL
         AND COALESCE(confirmedAt, createdAt) < ? ORDER BY createdAt`,
      [line, since],
    ),
    ...refs(
      `SELECT ref FROM issues WHERE line = ? AND assignee = ? AND outcome IS NOT NULL
         AND status NOT IN ('done', 'cancelled') AND heldAt IS NOT NULL AND COALESCE(confirmedAt, createdAt) < ?
       ORDER BY createdAt`,
      [line, DEVELOPER, since],
    ),
  ];
}

/** How many questions and tasks on a line wait to be re-confirmed. */
export function reconfirmingOn(ctx: Ctx, line: string): number {
  return staleHeldOn(ctx, line).length;
}

/** A question or a task for the developer, open, on the line it is held on. */
type HeldWork =
  | { kind: "decision"; value: Decision; line: string }
  | { kind: "issue"; value: Issue; line: string };

/**
 * What held confirm and held withdraw act on: a question still open, or a task for the developer still open, on a
 * line. An answered question or a closed task no longer stands or falls, and any other issue is not held work.
 */
function requireHeldItem(ctx: Ctx, ref: string): HeldWork {
  const entity = findEntity(ctx, ref);
  if (entity?.kind === "decision" && entity.value.line !== null) {
    if (entity.value.status !== "open") {
      throw new OctoError("conflict", `${entity.value.ref} is ${entity.value.status}, so it is not held`);
    }
    return { kind: "decision", value: entity.value, line: entity.value.line };
  }
  if (
    entity?.kind === "issue" &&
    entity.value.line !== null &&
    entity.value.assignee === DEVELOPER &&
    entity.value.outcome !== null
  ) {
    if (entity.value.status === "done" || entity.value.status === "cancelled") {
      throw new OctoError("conflict", `${entity.value.ref} is already closed, so it is not held`);
    }
    return { kind: "issue", value: entity.value, line: entity.value.line };
  }
  throw new OctoError("invalid_input", `${ref} is not a question or task on a line`);
}

export const taskOps = [
  bind(contracts.taskFile, (ctx, input) => {
    const lineRef = input.line ?? (ctx.developer ? null : onlyLineOf(ctx, ctx.actor, "the task is on"));
    if (lineRef === null) {
      throw new OctoError("invalid_input", "A task waits on a line", "Take a line first, or pass --line.");
    }
    const line = requireLine(ctx, lineRef);
    const place = placeOf(ctx, input.place);
    const fields = distinctFields(input.fields ?? []);
    const frees =
      input.frees === undefined
        ? (rows(
            ctx,
            IssueRow,
            "SELECT * FROM issues WHERE line = ? AND assignee = ? AND status NOT IN ('done', 'cancelled') ORDER BY updatedAt DESC LIMIT 1",
            [line.ref, ctx.actor],
          )[0] ?? null)
        : requireIssue(ctx, input.frees);
    // The issue it frees is held behind it, so that is a write to that issue's line too.
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
      // It holds up what the issue it frees holds up: that issue's plan step, on this line.
      ...(frees !== null && frees.line === line.ref && frees.step !== null ? { stepId: frees.step } : {}),
    });
    // Filed on a line no agent works on (in a wind-down), it is held until one does.
    ctx.sql.run("UPDATE issues SET place = ?, outcome = ?, fields = ?, heldAt = ? WHERE ref = ?", [
      place,
      input.outcome ?? "",
      JSON.stringify(fields),
      holdsWork(line) ? ctx.now : null,
      task.ref,
    ]);
    if (frees !== null) addLink(ctx, task.ref, "blocks", frees.ref);
    return requireIssue(ctx, task.ref);
  }),

  bind(contracts.taskReply, (ctx, input) => {
    const task = requireTask(ctx, input.ref);
    const said = oneLine(input.body);
    if (task.line !== null) {
      addToInbox(
        ctx,
        task.line,
        "task_reply",
        task.ref,
        freedBy(ctx, task.ref),
        `Reply on ${task.ref} ("${task.title}"): ${said}`,
      );
    }
    emit(ctx, {
      type: "task.replied",
      kind: "issue",
      ref: task.ref,
      project: task.project,
      line: task.line,
      summary: `${task.ref} replied to by ${ctx.developer ? "the developer" : ctx.actor}: ${said}`,
      attrs: { status: task.status },
    });
    return requireIssue(ctx, task.ref);
  }),

  bind(contracts.taskDone, (ctx, input) => {
    const task = requireTask(ctx, input.ref);
    const outcome = outcomeOf(task, input.values ?? {}, input.result ?? null);
    return closeTask(ctx, task, "done", outcome.result, outcome.said);
  }),

  bind(contracts.taskCant, (ctx, input) => {
    return closeTask(ctx, requireTask(ctx, input.ref), "cant", input.why);
  }),

  bind(contracts.placeList, (ctx) => places(ctx)),

  bind(contracts.placeAdd, (ctx, input) => {
    const exists = places(ctx).some((place) => place.name.toLowerCase() === input.name.toLowerCase());
    if (!exists) addPlace(ctx, input.name);
    return places(ctx);
  }),

  bind(contracts.placeRemove, (ctx, input) => {
    const { changes } = ctx.sql.run("DELETE FROM places WHERE lower(name) = lower(?)", [input.name]);
    if (changes > 0) emitPlace(ctx, "place.removed", input.name, `${input.name} removed from the places`);
    return places(ctx);
  }),

  bind(contracts.heldList, (ctx, input) => heldOn(ctx, requireLine(ctx, input.line).ref)),

  bind(contracts.heldConfirm, (ctx, input) => {
    const lines = new Set<string>();
    for (const ref of input.refs) {
      const entity = requireHeldItem(ctx, ref);
      // Re-confirmed, it is current again; on a line agents work on it reaches the developer from now.
      const working = !holdsWork(requireLine(ctx, entity.line));
      ctx.sql.run(
        `UPDATE ${entity.kind === "decision" ? "decisions" : "issues"} SET confirmedAt = ?, heldAt = ${working ? "NULL" : "heldAt"} WHERE ref = ?`,
        [ctx.now, entity.value.ref],
      );
      // In the log, so that a re-confirmation is seen; the log folds them into one sentence per line.
      emit(ctx, {
        type: "held.confirmed",
        kind: entity.kind,
        ref: entity.value.ref,
        project: entity.value.project,
        line: entity.line,
        summary: `${entity.value.ref} still stands, ${ctx.actor} re-confirmed: ${entity.value.title}`,
      });
      lines.add(entity.line);
    }
    return [...lines].flatMap((line) => heldOn(ctx, line)).filter((item) => input.refs.includes(item.ref));
  }),

  bind(contracts.heldWithdraw, (ctx, input) => {
    const withdrawn: string[] = [];
    for (const ref of input.refs) {
      const entity = requireHeldItem(ctx, ref);
      // Withdrawing is scoping: only from the line, or on a proposal by its proposer, as re-confirming is.
      if (entity.kind === "decision") withdrawQuestion(ctx, entity.value.ref, input.why);
      else {
        const why = input.why ?? "it no longer stands";
        closeTask(ctx, requireTask(ctx, entity.value.ref), "withdrawn", `Withdrawn: ${why}`, why);
      }
      withdrawn.push(entity.value.ref);
    }
    return { withdrawn };
  }),

  bind(contracts.taskAdd, (ctx, input) => {
    const line = requireLine(ctx, input.line);
    const task = createIssue(ctx, {
      project: line.repos[0] ?? ownProject(ctx),
      title: input.title,
      ...(input.body === undefined ? {} : { body: input.body }),
      assignee: DEVELOPER,
      line: line.ref,
    });
    // Nothing to report back to anyone: the outcome is empty, and Done needs no words.
    ctx.sql.run("UPDATE issues SET place = ?, outcome = '' WHERE ref = ?", [
      placeOf(ctx, input.place),
      task.ref,
    ]);
    return requireIssue(ctx, task.ref);
  }),

  bind(contracts.at, (ctx, input) => {
    // Where the developer is, only the developer can say: an agent was not there to see it.
    requireDeveloperInPerson(ctx, "say where they are");
    const place = placeOf(ctx, input.place);
    if (place === null) {
      ctx.sql.run("DELETE FROM developer_at");
    } else {
      const until = new Date(Date.parse(ctx.now) + AT_LASTS_MS).toISOString();
      ctx.sql.run(
        "INSERT INTO developer_at (id, place, until) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET place = excluded.place, until = excluded.until",
        [place, until],
      );
    }
    ctx.visibleChange = true;
    return atView(ctx);
  }),
];
