import type { Decision, DecisionCard, Priority } from "./schemas.ts";
import type { Ctx } from "./store/context.ts";
import { findEntity, summarize } from "./store/entities.ts";
import type { GraphSnapshot } from "./store/graph.ts";

const PRIORITY_WEIGHT: Readonly<Record<Priority, number>> = {
  urgent: 100,
  high: 60,
  medium: 30,
  low: 10,
  none: 5,
};
const WAITER_WEIGHT = 25;
const BLOCKED_WEIGHT = 10;
const BLOCKED_CAP = 50;
const AGE_CAP_HOURS = 48;
const OVERDUE_WEIGHT = 40;

export interface ScoreInput {
  priority: Priority;
  waiters: number;
  blockedOpen: number;
  ageHours: number;
  overdue: boolean;
}

/** Ranks the queue. Agents actually hanging on a decision outrank age, since that is real lost time right now. */
export function scoreDecision(input: ScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (input.waiters > 0) reasons.push(`${input.waiters} agent${input.waiters === 1 ? "" : "s"} waiting`);
  if (input.blockedOpen > 0)
    reasons.push(`blocks ${input.blockedOpen} open item${input.blockedOpen === 1 ? "" : "s"}`);
  if (input.overdue) reasons.push("overdue");
  if (input.priority === "urgent" || input.priority === "high") reasons.push(`${input.priority} priority`);
  const score =
    PRIORITY_WEIGHT[input.priority] +
    input.waiters * WAITER_WEIGHT +
    Math.min(input.blockedOpen * BLOCKED_WEIGHT, BLOCKED_CAP) +
    Math.min(input.ageHours, AGE_CAP_HOURS) / 2 +
    (input.overdue ? OVERDUE_WEIGHT : 0);
  return { score: Math.round(score * 10) / 10, reasons };
}

export function buildDecisionCard(
  ctx: Ctx,
  decision: Decision,
  graph: GraphSnapshot,
  waitersByRef: ReadonlyMap<string, readonly string[]>,
): DecisionCard {
  const summaries = (refs: readonly string[]) =>
    refs.flatMap((ref) => {
      const entity = findEntity(ctx, ref);
      return entity === null ? [] : [summarize(entity)];
    });
  const blocks = summaries(graph.blocking(decision.ref));
  const affects = summaries(graph.from(decision.ref, "affects"));
  const waiters = [...(waitersByRef.get(decision.ref) ?? [])];
  const { score, reasons } = scoreDecision({
    priority: decision.priority,
    waiters: waiters.length,
    blockedOpen: blocks.filter((item) => graph.open.has(item.ref)).length,
    ageHours: (Date.parse(ctx.now) - Date.parse(decision.createdAt)) / 3_600_000,
    overdue: decision.dueAt !== null && decision.dueAt < ctx.now,
  });
  return { decision, score, reasons, blocks, affects, waiters };
}
