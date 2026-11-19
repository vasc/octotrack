import { contracts } from "../contracts.ts";
import { parseDecisionRows } from "../decision-rows.ts";
import { OctoError } from "../errors.ts";
import { buildDecisionCard } from "../queue.ts";
import type {
  Channel,
  Decision,
  DecisionCard,
  DecisionKind,
  DecisionOption,
  EventAttrs,
  Line,
  Priority,
  UrgentReason,
} from "../schemas.ts";
import type { EventTypeName } from "../query/values.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { allLines, requireDecision, requireIssue, requireLine, requireProject } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { DecisionRow, IssueRow, WatchRow } from "../store/rows.ts";
import { toWatch } from "../watch/engine.ts";
import { z } from "zod";
import { holdsWork } from "../agents/claims.ts";
import { DEVELOPER } from "../agents/state.ts";
import { addNotice, claimOf } from "../store/agents.ts";
import { addToInbox } from "../store/inbox.ts";
import { bind } from "./bind.ts";
import { requireServer } from "./developer.ts";
import { addLink } from "./links.ts";

export function decisionAttrs(decision: Decision): EventAttrs {
  return {
    status: decision.status,
    priority: decision.priority,
    type: decision.kind,
    assignee: decision.requestedBy,
    ...(decision.channel === null ? {} : { channel: decision.channel }),
  };
}

function normalizeOptions(
  options: readonly { key: string; label: string; description?: string }[],
): DecisionOption[] {
  const keys = new Set<string>();
  return options.map((option) => {
    if (keys.has(option.key)) throw new OctoError("invalid_input", `Duplicate option key "${option.key}"`);
    keys.add(option.key);
    return { key: option.key, label: option.label, description: option.description ?? "" };
  });
}

interface InsertDecision {
  title: string;
  context?: string;
  kind?: DecisionKind;
  priority?: Priority;
  project?: string;
  options?: readonly { key: string; label: string; description?: string }[];
  recommendation?: string;
  dueAt?: string;
  line?: string | null;
  issue?: string | null;
  why?: string;
  urgent?: UrgentReason;
  held?: boolean;
}

/**
 * Where a question belongs: the line it names or the line the asker is on, and the issue it names or the one the asker
 * holds there. A question from an agent on no line keeps the rules from before lines, until those go.
 */
function placeQuestion(ctx: Ctx, input: InsertDecision): { line: Line | null; issue: string | null } {
  const named = input.issue === undefined || input.issue === null ? null : requireIssue(ctx, input.issue);
  // A question about an issue on a line belongs to that line, whoever asks it.
  const lineRef =
    input.line ?? named?.line ?? (ctx.developer ? null : (claimOf(ctx, ctx.actor)?.line ?? null));
  const line = lineRef === null || lineRef === undefined ? null : requireLine(ctx, lineRef);
  if (named !== null) {
    if (line !== null && named.line !== line.ref) {
      throw new OctoError("invalid_input", `${named.ref} is not on ${line.ref}`);
    }
    return { line, issue: named.ref };
  }
  if (line === null) return { line, issue: null };
  const [held] = rows(
    ctx,
    IssueRow,
    "SELECT * FROM issues WHERE line = ? AND assignee = ? AND status NOT IN ('done', 'cancelled') ORDER BY updatedAt DESC LIMIT 1",
    [line.ref, ctx.actor],
  );
  return { line, issue: held?.ref ?? null };
}

/**
 * A question on a line is read by someone who has read nothing else: it needs a situation, options that say what
 * happens if picked, and the reason behind any recommendation. Urgent is for working lines and fixed reasons only.
 */
function checkStandalone(input: InsertDecision, line: Line): void {
  if ((input.context ?? "").trim() === "") {
    throw new OctoError(
      "invalid_input",
      "A question needs its situation, written for someone who has read nothing else",
      'Pass --context "<what is going on, what was tried, what the choice changes>".',
    );
  }
  const options = input.options ?? [];
  if (options.length === 0 || options.some((option) => (option.description ?? "").trim() === "")) {
    throw new OctoError(
      "invalid_input",
      "Every option must say what happens if it is picked",
      "Give each option a description: what the agent will do, and what it costs.",
    );
  }
  if (input.recommendation !== undefined && input.why === undefined) {
    throw new OctoError("invalid_input", "Say why you recommend it", 'Pass --why "<the reason>".');
  }
  if (input.urgent !== undefined && line.state !== "working") {
    throw new OctoError(
      "invalid_input",
      `Urgent is for questions on lines being worked on; ${line.ref} is not`,
    );
  }
}

function insertDecision(ctx: Ctx, input: InsertDecision): Decision {
  const project = input.project === undefined ? null : requireProject(ctx, input.project).ref;
  const ref = `D-${nextNumber(ctx, "decision")}`;
  ctx.sql.run(
    `INSERT INTO decisions (ref, project, kind, title, context, options, recommendation, status, priority, requestedBy, dueAt, wakeAddress, line, issue, recommendationWhy, urgentReason, heldAt, version, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      ref,
      project,
      input.kind ?? "technical",
      input.title,
      input.context ?? "",
      JSON.stringify(normalizeOptions(input.options ?? [])),
      input.recommendation ?? null,
      input.priority ?? "medium",
      ctx.actor,
      input.dueAt ?? null,
      // Where its asker is woken is the address the asker registered, read when the answer comes (D14).
      null,
      input.line ?? null,
      input.issue ?? null,
      input.why ?? null,
      input.urgent ?? null,
      input.held === true ? ctx.now : null,
      ctx.now,
      ctx.now,
    ],
  );
  return requireDecision(ctx, ref);
}

function describeOutcome(decision: Decision): string {
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  // Without a listed option, the note is the answer rather than a comment on one.
  if (chosen === undefined && decision.resolutionNote !== null && decision.resolutionNote !== "") {
    return `"${decision.resolutionNote}"`;
  }
  const outcome = chosen ? `"${chosen.label}"` : "no listed option";
  const note =
    decision.resolutionNote === null || decision.resolutionNote === "" ? "" : ` (${decision.resolutionNote})`;
  return `${outcome}${note}`;
}

interface ResolveInput {
  ref: string;
  option?: string | null;
  note?: string | null;
  channel?: Channel;
  decidedAt?: string;
  sourceUrl?: string;
  force?: boolean;
}

/**
 * A question on a line is answered, postponed, reopened or replaced only by the developer, or by an agent quoting
 * them. One from before lines keeps the older rules, until those go.
 */
function resolveDecision(ctx: Ctx, input: ResolveInput): Decision {
  const current = requireDecision(ctx, input.ref);
  const option = input.option ?? null;
  const note = input.note ?? null;

  if (current.status === "decided") {
    if (current.chosenOption === option && (note === null || current.resolutionNote === note)) return current;
    if (input.force !== true) {
      throw new OctoError(
        "conflict",
        `${current.ref} was already decided by ${current.decidedBy ?? "someone"}: ${describeOutcome(current)}`,
        "Pass --force to change the outcome. Everything linked to it will be flagged for re-checking.",
      );
    }
  }
  if (option !== null && current.options.length > 0 && !current.options.some((item) => item.key === option)) {
    const valid = current.options.map((item) => item.key).join(", ");
    throw new OctoError(
      "invalid_input",
      `${current.ref} has no option “${option}”. Its options are ${valid}.`,
      `Valid options: ${valid}.`,
    );
  }
  if (option !== null && current.options.length === 0 && note === null) {
    // A decision asked without options has nothing to key into, so the answer itself is the note.
    return resolveDecision(ctx, { ...input, option: null, note: option });
  }
  if (option === null && note === null) {
    throw new OctoError(
      "invalid_input",
      `Say what was decided for ${current.ref}`,
      "Pass --option <key>, or --note when no listed option applies.",
    );
  }

  const wasDecided = current.status === "decided";
  const changes = applyPatch(ctx, "decisions", current.ref, current, {
    status: "decided",
    postponedAt: null,
    // Whoever answered their own question already has the answer. Anyone else's goes in the inbox, even if it changed.
    pickedUpAt: ctx.actor === current.requestedBy ? ctx.now : null,
    pickedUpBy: ctx.actor === current.requestedBy ? ctx.actor : null,
    reportStatus: null,
    reportNote: null,
    reportedAt: null,
    wokenAt: null,
    wakeError: null,
    chosenOption: option,
    resolutionNote: note,
    decidedBy: ctx.actor,
    decidedAt: input.decidedAt ?? ctx.now,
    channel: input.channel ?? ctx.channel,
    sourceUrl: input.sourceUrl,
  });
  const updated = requireDecision(ctx, current.ref);
  if (updated.line !== null) {
    addToInbox(
      ctx,
      updated.line,
      "answer",
      updated.ref,
      updated.issue,
      `${updated.ref} ${wasDecided ? "answer changed, replacing the earlier one" : "answered"}: ${describeOutcome(updated)} on "${updated.title}"`,
    );
  }
  emit(ctx, {
    type: wasDecided ? "decision.changed" : "decision.resolved",
    kind: "decision",
    ref: updated.ref,
    project: updated.project,
    line: updated.line,
    summary: `${updated.ref} ${wasDecided ? "changed to" : "decided:"} ${describeOutcome(updated)} on "${updated.title}"`,
    attrs: decisionAttrs(updated),
    changes,
  });
  return updated;
}

function transition(
  ctx: Ctx,
  rawRef: string,
  type: EventTypeName,
  summary: (decision: Decision) => string,
  patch: Parameters<typeof applyPatch>[4],
  note: string | undefined,
): Decision {
  const current = requireDecision(ctx, rawRef);
  const changes = applyPatch(ctx, "decisions", current.ref, current, {
    ...patch,
    ...(note === undefined ? {} : { resolutionNote: note }),
  });
  const updated = requireDecision(ctx, current.ref);
  emit(ctx, {
    type,
    kind: "decision",
    ref: updated.ref,
    project: updated.project,
    line: updated.line,
    summary: summary(updated),
    attrs: decisionAttrs(updated),
    changes,
  });
  return updated;
}

const Waiting = z.object({ id: z.number() });
const StepOrdRow = z.object({ ref: z.string(), ord: z.number().int() });

/**
 * A question is refined whatever it stands at, except while an answer to it waits out its Undo: that answer is applied
 * by option key, so nothing may change under it.
 */
function refineable(ctx: Ctx, current: Decision): void {
  if (ctx.developer || ctx.system) return;
  const waiting = one(
    ctx,
    Waiting,
    "SELECT id FROM pending_choices WHERE state = 'pending' AND json_extract(input, '$.ref') = ? LIMIT 1",
    [current.ref],
  );
  if (waiting !== null) {
    throw new OctoError(
      "conflict",
      `${current.ref} has an answer waiting to take effect, so it is not changed under it`,
      "Wait a few seconds, then read the answer.",
    );
  }
}

function requireAnswered(ctx: Ctx, ref: string): Decision {
  const current = requireDecision(ctx, ref);
  if (current.status !== "decided") {
    throw new OctoError("conflict", `${current.ref} is ${current.status}, so it has no answer yet`);
  }
  return current;
}

/** Which agents are live-waiting on which refs. Drives the queue ranking and "2 agents waiting". */
export function waitersByRef(ctx: Ctx): Map<string, string[]> {
  const active = rows(ctx, WatchRow, "SELECT * FROM watches WHERE status = 'active'").map((row) =>
    toWatch(row, ctx.now),
  );
  const waiters = new Map<string, string[]>();
  for (const watch of active) {
    if (!watch.waiting) continue;
    for (const ref of watch.refs) {
      const existing = waiters.get(ref) ?? [];
      if (!existing.includes(watch.agent)) waiters.set(ref, [...existing, watch.agent]);
    }
  }
  return waiters;
}

/** Questions from before lines: oldest first, postponed below the rest, the last one postponed at the very bottom. */
function compareCards(a: DecisionCard, b: DecisionCard): number {
  const [first, second] = [a.decision.postponedAt, b.decision.postponedAt];
  if (first !== null && second !== null) return first.localeCompare(second);
  if (first !== null) return 1;
  if (second !== null) return -1;
  return a.decision.createdAt.localeCompare(b.decision.createdAt);
}

function isUrgent(decision: Decision): boolean {
  return decision.urgentReason !== null && decision.notUrgentAt === null;
}

/**
 * The developer's order decides what reaches them: urgent questions first, then each working line's questions in line
 * order, by the plan step they hold up, with Later at the bottom of its own line. Questions from before lines follow,
 * ranked as they were until those go. Questions on lines that are not being worked on are held, and not in the queue.
 */
export function buildQueue(ctx: Ctx, query: string | undefined) {
  const graph = loadGraph(ctx);
  const waiting = waitersByRef(ctx);
  const order = new Map(allLines(ctx, "WHERE state = 'working'").map((line, index) => [line.ref, index]));
  const behindTasks = new Set(
    rows(
      ctx,
      z.object({ ref: z.string() }),
      `SELECT l.toRef AS ref FROM links l JOIN issues t ON t.ref = l.fromRef
       WHERE l.rel = 'blocks' AND t.assignee = ? AND t.outcome IS NOT NULL AND t.status NOT IN ('done', 'cancelled')`,
      [DEVELOPER],
    ).map((row) => row.ref),
  );
  // Held questions that went stale while their line waited reach the developer only once an agent re-confirms them.
  const open = rows(ctx, DecisionRow, "SELECT * FROM decisions WHERE status = 'open' AND heldAt IS NULL")
    .filter((decision) => decision.line === null || order.has(decision.line))
    .filter((decision) => !behindTasks.has(decision.ref))
    .map((value) => ({ kind: "decision" as const, value }));
  // A question follows the plan step its issue serves, in the tree's order.
  const stepOf = new Map(
    rows(
      ctx,
      StepOrdRow,
      `SELECT i.ref AS ref, s.ord AS ord FROM issues i JOIN plan_steps s ON s.id = i.step
       WHERE i.ref IN (SELECT issue FROM decisions WHERE status = 'open')`,
    ).map((row) => [row.ref, row.ord]),
  );
  const step = (decision: Decision) =>
    decision.issue === null ? null : (stepOf.get(decision.issue) ?? null);
  const compare = (a: DecisionCard, b: DecisionCard): number => {
    const [x, y] = [a.decision, b.decision];
    if (isUrgent(x) !== isUrgent(y)) return isUrgent(x) ? -1 : 1;
    if (x.line === null || y.line === null) {
      if (x.line !== y.line) return x.line === null ? 1 : -1;
      return compareCards(a, b);
    }
    const byLine = (order.get(x.line) ?? 0) - (order.get(y.line) ?? 0);
    if (byLine !== 0) return byLine;
    if ((x.postponedAt === null) !== (y.postponedAt === null)) return x.postponedAt === null ? -1 : 1;
    const [sx, sy] = [step(x), step(y)];
    if (sx !== sy) return sx === null ? 1 : sy === null ? -1 : sx - sy;
    return (x.postponedAt ?? x.createdAt).localeCompare(y.postponedAt ?? y.createdAt);
  };
  return filterEntities(ctx, open, query, graph)
    .map((entity) => buildDecisionCard(ctx, entity.value, graph, waiting))
    .sort(compare);
}

/**
 * A question that no longer stands, withdrawn by the developer or any agent; the log shows who.
 */
export function withdrawQuestion(ctx: Ctx, ref: string, note: string | undefined): Decision {
  const current = requireDecision(ctx, ref);
  if (current.status === "withdrawn") return current;
  return transition(
    ctx,
    ref,
    "decision.withdrawn",
    (decision) => `${decision.ref} withdrawn: ${decision.title}`,
    { status: "withdrawn" },
    note,
  );
}

export const decisionOps = [
  bind(contracts.decisionAsk, (ctx, input) => {
    const placed = placeQuestion(ctx, input);
    if (placed.line !== null) {
      // A question joins its line's queue and its answer goes to whoever holds the line: asked only from that line.
      if (!ctx.developer) checkStandalone(input, placed.line);
    } else if (input.urgent !== undefined) {
      throw new OctoError("invalid_input", "Urgent is for questions on lines being worked on");
    }
    const decision = insertDecision(ctx, {
      ...input,
      project: input.project ?? placed.line?.repos[0],
      line: placed.line?.ref ?? null,
      issue: placed.issue,
      // Asked on a line no agent works on (in a wind-down): held until one does.
      held: placed.line !== null && holdsWork(placed.line),
    });

    if (input.waitsFor !== undefined) {
      const task = requireIssue(ctx, input.waitsFor);
      if (task.assignee !== DEVELOPER || task.outcome === null) {
        throw new OctoError("invalid_input", `${task.ref} is not a task for the developer`);
      }
      // Held behind the task: asking the developer what their own measurement is about to answer wastes their time.
      addLink(ctx, task.ref, "blocks", decision.ref);
    }
    for (const target of input.blocks ?? []) addLink(ctx, decision.ref, "blocks", target);
    for (const target of input.affects ?? []) addLink(ctx, decision.ref, "affects", target);
    emit(ctx, {
      type: "decision.requested",
      kind: "decision",
      ref: decision.ref,
      project: decision.project,
      line: decision.line,
      summary: `${decision.ref} needs a decision: ${decision.title}`,
      attrs: decisionAttrs(decision),
    });
    return decision;
  }),

  bind(contracts.decisionUpdate, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    assertVersion(current.ref, current.version, input.ifVersion);
    refineable(ctx, current);
    // An answer names its option by key: options that leave it out would leave the answer pointing at nothing.
    if (
      input.options !== undefined &&
      current.chosenOption !== null &&
      !normalizeOptions(input.options).some((option) => option.key === current.chosenOption)
    ) {
      throw new OctoError(
        "invalid_input",
        `${current.ref} was answered with option ${current.chosenOption}, which these options leave out`,
        `Keep option ${current.chosenOption} among them, or reopen the question first.`,
      );
    }
    if (current.line !== null && !ctx.developer) {
      // Refined, it must still stand alone, as it had to when asked.
      const recommendation =
        input.recommendation === undefined ? current.recommendation : input.recommendation;
      const why = input.why ?? current.recommendationWhy;
      checkStandalone(
        {
          title: input.title ?? current.title,
          context: input.context ?? current.context,
          options: input.options ?? current.options,
          ...(recommendation === null ? {} : { recommendation }),
          ...(why === null ? {} : { why }),
        },
        requireLine(ctx, current.line),
      );
    }
    const changes = applyPatch(ctx, "decisions", current.ref, current, {
      title: input.title,
      context: input.context,
      kind: input.kind,
      priority: input.priority,
      project:
        input.project === undefined || input.project === null
          ? input.project
          : requireProject(ctx, input.project).ref,
      options: input.options === undefined ? undefined : normalizeOptions(input.options),
      recommendation: input.recommendation,
      recommendationWhy: input.why,
      dueAt: input.dueAt,
    });
    const updated = requireDecision(ctx, current.ref);
    const fields = Object.keys(changes);
    if (fields.length > 0) {
      emit(ctx, {
        type: "decision.updated",
        kind: "decision",
        ref: updated.ref,
        project: updated.project,
        line: updated.line,
        summary: `${updated.ref} refined (${fields.join(", ")}): ${updated.title}`,
        attrs: decisionAttrs(updated),
        changes,
      });
    }
    return updated;
  }),

  bind(contracts.decisionResolve, (ctx, input) => resolveDecision(ctx, input)),

  bind(contracts.decisionResolveBatch, (ctx, input) => {
    const fromRows = input.text === undefined ? [] : parseDecisionRows(input.text);
    const items = [...(input.items ?? []), ...fromRows];
    if (items.length === 0) throw new OctoError("invalid_input", "Nothing to record", "Pass items or text.");
    return {
      results: items.map((item) => {
        try {
          // A failing item throws before anything is written, so the good ones can still land.
          const decision = resolveDecision(ctx, { ...item, channel: input.channel ?? "out_of_band" });
          return { ref: decision.ref, ok: true, decision, error: null };
        } catch (error) {
          if (!(error instanceof OctoError)) throw error;
          return { ref: item.ref, ok: false, decision: null, error: error.message };
        }
      }),
    };
  }),

  bind(contracts.decisionRecord, (ctx, input) => {
    // An agent records what the developer told it, on its line or on none; the log shows who recorded it.
    const placed = placeQuestion(ctx, input);
    const decision = insertDecision(ctx, {
      title: input.title,
      context: input.context,
      kind: input.kind,
      project: input.project ?? placed.line?.repos[0],
      options: [{ key: "chosen", label: input.chosen }],
      priority: "none",
      line: placed.line?.ref ?? null,
      issue: placed.issue,
    });
    // An `affects` link raises drift on its target, routed to that line's owner.
    for (const target of input.blocks ?? []) addLink(ctx, decision.ref, "blocks", target);
    for (const target of input.affects ?? []) addLink(ctx, decision.ref, "affects", target);
    return resolveDecision(ctx, {
      ref: decision.ref,
      option: "chosen",
      note: input.note,
      channel: "out_of_band",
      decidedAt: input.decidedAt,
      sourceUrl: input.sourceUrl,
    });
  }),

  bind(contracts.decisionReopen, (ctx, input) => {
    return transition(
      ctx,
      input.ref,
      "decision.reopened",
      (decision) => `${decision.ref} reopened: ${decision.title}`,
      {
        status: "open",
        postponedAt: null,
        pickedUpAt: null,
        pickedUpBy: null,
        reportStatus: null,
        reportNote: null,
        reportedAt: null,
        wokenAt: null,
        wakeError: null,
        chosenOption: null,
        decidedBy: null,
        decidedAt: null,
        channel: null,
        supersededBy: null,
      },
      input.note,
    );
  }),

  bind(contracts.decisionPostpone, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    if (current.status !== "open") {
      throw new OctoError(
        "conflict",
        `${current.ref} is ${current.status}, only open decisions can be postponed`,
      );
    }
    const undo = input.undo === true;
    return transition(
      ctx,
      input.ref,
      undo ? "decision.unpostponed" : "decision.postponed",
      (decision) => `${decision.ref} ${undo ? "brought back" : "postponed"}: ${decision.title}`,
      { postponedAt: undo ? null : ctx.now },
      undefined,
    );
  }),
  bind(contracts.decisionInbox, (ctx, input) =>
    input.all === true
      ? rows(
          ctx,
          DecisionRow,
          "SELECT * FROM decisions WHERE status = 'decided' AND pickedUpAt IS NULL ORDER BY decidedAt",
        )
      : rows(
          ctx,
          DecisionRow,
          "SELECT * FROM decisions WHERE status = 'decided' AND pickedUpAt IS NULL AND requestedBy = ? ORDER BY decidedAt",
          [ctx.actor],
        ),
  ),
  bind(contracts.decisionPickup, (ctx, input) => {
    requireAnswered(ctx, input.ref);
    return transition(
      ctx,
      input.ref,
      "decision.picked_up",
      (decision) => `${decision.ref} picked up by ${ctx.actor}: ${decision.title}`,
      { pickedUpAt: ctx.now, pickedUpBy: ctx.actor },
      undefined,
    );
  }),
  bind(contracts.decisionReport, (ctx, input) => {
    const current = requireAnswered(ctx, input.ref);
    const verb = input.status === "done" ? "carried out" : "partly carried out";
    return transition(
      ctx,
      input.ref,
      "decision.reported",
      (decision) => `${decision.ref} ${verb}: ${input.note}`,
      {
        pickedUpAt: current.pickedUpAt ?? ctx.now,
        pickedUpBy: current.pickedUpBy ?? ctx.actor,
        reportStatus: input.status,
        reportNote: input.note,
        reportedAt: ctx.now,
      },
      undefined,
    );
  }),
  bind(contracts.decisionWakes, (ctx) =>
    rows(
      ctx,
      DecisionRow.extend({ registered: z.string().nullable() }),
      // A question on a line wakes whoever holds the line, through its inbox, not the session that asked. One on no
      // line wakes its asker at the address it registered; one asked before that keeps the address it was asked with.
      `SELECT d.*, a.wakeAddress AS registered FROM decisions d LEFT JOIN agents a ON a.name = d.requestedBy
       WHERE d.status = 'decided' AND d.line IS NULL AND d.wokenAt IS NULL AND d.pickedUpAt IS NULL
         AND (a.name IS NULL OR a.stoppedAt IS NULL) AND COALESCE(a.wakeAddress, d.wakeAddress) IS NOT NULL
       ORDER BY d.decidedAt`,
    ).map(({ registered, ...decision }) => ({
      ...decision,
      wakeAddress: registered ?? decision.wakeAddress,
    })),
  ),
  bind(contracts.decisionWoken, (ctx, input) => {
    requireServer(ctx);
    const current = requireDecision(ctx, input.ref);
    applyPatch(ctx, "decisions", current.ref, current, {
      wokenAt: current.wokenAt ?? ctx.now,
      wakeError: input.error ?? null,
    });
    return requireDecision(ctx, current.ref);
  }),
  bind(contracts.decisionWithdraw, (ctx, input) => withdrawQuestion(ctx, input.ref, input.note)),

  bind(contracts.decisionSupersede, (ctx, input) => {
    const replacement = requireDecision(ctx, input.by);
    const current = requireDecision(ctx, input.ref);
    if (current.ref === replacement.ref)
      throw new OctoError("invalid_input", "A decision cannot supersede itself");
    addLink(ctx, replacement.ref, "supersedes", current.ref);
    return transition(
      ctx,
      current.ref,
      "decision.superseded",
      (decision) => `${decision.ref} superseded by ${replacement.ref}: ${decision.title}`,
      { status: "superseded", supersededBy: replacement.ref },
      input.note,
    );
  }),

  bind(contracts.decisionNotUrgent, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    if (current.urgentReason === null || current.notUrgentAt !== null) {
      throw new OctoError("conflict", `${current.ref} is not urgent`);
    }
    const updated = transition(
      ctx,
      current.ref,
      "decision.not_urgent",
      (decision) => `${decision.ref} is not urgent, the developer says: ${decision.title}`,
      { notUrgentAt: ctx.now },
      undefined,
    );
    addNotice(
      ctx,
      current.requestedBy,
      "not_urgent",
      current.line,
      `${current.ref} is not urgent: the developer sent it back to its place in the line order.`,
      false,
    );
    return updated;
  }),

  bind(contracts.decisionList, (ctx, input) => {
    const graph = loadGraph(ctx);
    const all = rows(ctx, DecisionRow, "SELECT * FROM decisions ORDER BY updatedAt DESC").map((value) => ({
      kind: "decision" as const,
      value,
    }));
    return filterEntities(ctx, all, input.query, graph)
      .slice(0, input.limit ?? 200)
      .map((entity) => entity.value);
  }),

  bind(contracts.decisionQueue, (ctx, input) => buildQueue(ctx, input.query).slice(0, input.limit ?? 200)),
];
