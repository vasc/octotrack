import type { Decision, DecisionCard, Priority } from "./schemas.ts";
import type { Ctx } from "./store/context.ts";
import { findEntity, summarize } from "./store/entities.ts";
import type { GraphSnapshot } from "./store/graph.ts";

export interface ReasonInput {
  priority: Priority;
  waiters: number;
  blockedOpen: number;
  overdue: boolean;
}

/**
 * Why a question matters, in words, for the card. The order comes from the developer's line order, not from these:
 * a computed score competed with the developer's own priorities (docs/DESIGN.md, D13).
 */
export function reasonsFor(input: ReasonInput): string[] {
  const reasons: string[] = [];
  if (input.waiters > 0) reasons.push(`${input.waiters} agent${input.waiters === 1 ? "" : "s"} waiting`);
  if (input.blockedOpen > 0)
    reasons.push(`blocks ${input.blockedOpen} open item${input.blockedOpen === 1 ? "" : "s"}`);
  if (input.overdue) reasons.push("overdue");
  if (input.priority === "urgent" || input.priority === "high") reasons.push(`${input.priority} priority`);
  return reasons;
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
  const reasons = reasonsFor({
    priority: decision.priority,
    waiters: waiters.length,
    blockedOpen: blocks.filter((item) => graph.open.has(item.ref)).length,
    overdue: decision.dueAt !== null && decision.dueAt < ctx.now,
  });
  return { decision, reasons, blocks, affects, waiters };
}
