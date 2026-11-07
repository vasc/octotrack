import { contracts } from "../contracts.ts";
import { parseDecisionLines } from "../decision-lines.ts";
import { OctoError } from "../errors.ts";
import { buildDecisionCard } from "../queue.ts";
import type {
  Channel,
  Decision,
  DecisionCard,
  DecisionKind,
  DecisionOption,
  EventAttrs,
  Priority,
} from "../schemas.ts";
import { applyPatch, assertVersion, emit, nextNumber } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { rows } from "../store/context.ts";
import { filterEntities } from "../store/docs.ts";
import { requireDecision, requireProject } from "../store/entities.ts";
import { loadGraph } from "../store/graph.ts";
import { DecisionRow, WatchRow } from "../store/rows.ts";
import { toWatch } from "../watch/engine.ts";
import { bind } from "./bind.ts";
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
  wake?: string;
}

function insertDecision(ctx: Ctx, input: InsertDecision): Decision {
  const project = input.project === undefined ? null : requireProject(ctx, input.project).ref;
  const ref = `D-${nextNumber(ctx, "decision")}`;
  ctx.sql.run(
    `INSERT INTO decisions (ref, project, kind, title, context, options, recommendation, status, priority, requestedBy, dueAt, wakeAddress, version, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 1, ?, ?)`,
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
      input.wake ?? null,
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

function resolveDecision(ctx: Ctx, input: ResolveInput): Decision {
  const current = requireDecision(ctx, input.ref);
  const option = input.option ?? null;
  const note = input.note ?? null;

  if (current.status === "withdrawn" || current.status === "superseded") {
    throw new OctoError(
      "conflict",
      `${current.ref} is ${current.status}`,
      "Reopen it first if it still matters.",
    );
  }
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
      `${current.ref} has no option "${option}"`,
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
  emit(ctx, {
    type: wasDecided ? "decision.changed" : "decision.resolved",
    kind: "decision",
    ref: updated.ref,
    project: updated.project,
    summary: `${updated.ref} ${wasDecided ? "changed to" : "decided:"} ${describeOutcome(updated)} on "${updated.title}"`,
    attrs: decisionAttrs(updated),
    changes,
  });
  return updated;
}

function transition(
  ctx: Ctx,
  rawRef: string,
  type: string,
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
    summary: summary(updated),
    attrs: decisionAttrs(updated),
    changes,
  });
  return updated;
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

/** Postponed decisions go below everything else, and the last one postponed goes to the very bottom. */
function compareCards(a: DecisionCard, b: DecisionCard): number {
  const [first, second] = [a.decision.postponedAt, b.decision.postponedAt];
  if (first !== null && second !== null) return first.localeCompare(second);
  if (first !== null) return 1;
  if (second !== null) return -1;
  return b.score - a.score || a.decision.createdAt.localeCompare(b.decision.createdAt);
}

export function buildQueue(ctx: Ctx, query: string | undefined) {
  const graph = loadGraph(ctx);
  const waiting = waitersByRef(ctx);
  const open = rows(ctx, DecisionRow, "SELECT * FROM decisions WHERE status = 'open'").map((value) => ({
    kind: "decision" as const,
    value,
  }));
  return filterEntities(ctx, open, query, graph)
    .map((entity) => buildDecisionCard(ctx, entity.value, graph, waiting))
    .sort(compareCards);
}

export const decisionOps = [
  bind(contracts.decisionAsk, (ctx, input) => {
    const decision = insertDecision(ctx, input);
    for (const target of input.blocks ?? []) addLink(ctx, decision.ref, "blocks", target);
    for (const target of input.affects ?? []) addLink(ctx, decision.ref, "affects", target);
    emit(ctx, {
      type: "decision.requested",
      kind: "decision",
      ref: decision.ref,
      project: decision.project,
      summary: `${decision.ref} needs a decision: ${decision.title}`,
      attrs: decisionAttrs(decision),
    });
    return decision;
  }),

  bind(contracts.decisionUpdate, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    assertVersion(current.ref, current.version, input.ifVersion);
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
        summary: `${updated.ref} refined (${fields.join(", ")}): ${updated.title}`,
        attrs: decisionAttrs(updated),
        changes,
      });
    }
    return updated;
  }),

  bind(contracts.decisionResolve, (ctx, input) => resolveDecision(ctx, input)),

  bind(contracts.decisionResolveBatch, (ctx, input) => {
    const fromLines = input.text === undefined ? [] : parseDecisionLines(input.text);
    const items = [...(input.items ?? []), ...fromLines];
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
    const decision = insertDecision(ctx, {
      title: input.title,
      context: input.context,
      kind: input.kind,
      project: input.project,
      options: [{ key: "chosen", label: input.chosen }],
      priority: "none",
    });
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

  bind(contracts.decisionReopen, (ctx, input) =>
    transition(
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
    ),
  ),

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
  bind(contracts.decisionWake, (ctx, input) =>
    transition(
      ctx,
      input.ref,
      "decision.wake_changed",
      (decision) =>
        `${decision.ref} ${input.address === null ? "will not wake anyone" : "will wake its session"}`,
      { wakeAddress: input.address, wokenAt: null, wakeError: null },
      undefined,
    ),
  ),
  bind(contracts.decisionWakes, (ctx) =>
    rows(
      ctx,
      DecisionRow,
      "SELECT * FROM decisions WHERE status = 'decided' AND wakeAddress IS NOT NULL AND wokenAt IS NULL AND pickedUpAt IS NULL ORDER BY decidedAt",
    ),
  ),
  bind(contracts.decisionWoken, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    applyPatch(ctx, "decisions", current.ref, current, {
      wokenAt: current.wokenAt ?? ctx.now,
      wakeError: input.error ?? null,
    });
    return requireDecision(ctx, current.ref);
  }),
  bind(contracts.decisionWithdraw, (ctx, input) => {
    const current = requireDecision(ctx, input.ref);
    if (current.status !== "open") {
      throw new OctoError(
        "conflict",
        `${current.ref} is ${current.status}, only open decisions can be withdrawn`,
      );
    }
    return transition(
      ctx,
      input.ref,
      "decision.withdrawn",
      (decision) => `${decision.ref} withdrawn: ${decision.title}`,
      { status: "withdrawn" },
      input.note,
    );
  }),

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
