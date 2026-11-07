import { contracts } from "../contracts.ts";
import type { EntitySummary, Link, LinkRel } from "../schemas.ts";
import { emit } from "../store/common.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { findEntity, requireEntity, resolveRef, summarize } from "../store/entities.ts";
import { assertNoBlockCycle, loadGraph } from "../store/graph.ts";
import { CountRow, LinkRow } from "../store/rows.ts";
import { bind } from "./bind.ts";

export function wasRemoved(ctx: Ctx, fromRef: string, rel: LinkRel, toRef: string): boolean {
  const found = one(
    ctx,
    CountRow,
    "SELECT COUNT(*) AS n FROM link_tombstones WHERE fromRef = ? AND rel = ? AND toRef = ?",
    [fromRef, rel, toRef],
  );
  return (found?.n ?? 0) > 0;
}

export function addLink(ctx: Ctx, rawFrom: string, rel: LinkRel, rawTo: string): Link {
  const fromEntity = requireEntity(ctx, rawFrom);
  const fromRef = fromEntity.value.ref;
  const toRef = resolveRef(ctx, rawTo);
  if (rel === "blocks") assertNoBlockCycle(ctx, fromRef, toRef);
  ctx.sql.run("DELETE FROM link_tombstones WHERE fromRef = ? AND rel = ? AND toRef = ?", [
    fromRef,
    rel,
    toRef,
  ]);
  const existing = rows(ctx, LinkRow, "SELECT * FROM links WHERE fromRef = ? AND rel = ? AND toRef = ?", [
    fromRef,
    rel,
    toRef,
  ]);
  const [found] = existing;
  if (found !== undefined) return found;
  ctx.sql.run("INSERT INTO links (fromRef, rel, toRef, createdAt, createdBy) VALUES (?, ?, ?, ?, ?)", [
    fromRef,
    rel,
    toRef,
    ctx.now,
    ctx.actor,
  ]);
  emit(ctx, {
    type: "link.added",
    kind: fromEntity.kind,
    ref: fromRef,
    project: summarize(fromEntity).project,
    summary: `${fromRef} ${rel} ${toRef}`,
    related: [toRef],
  });
  return { fromRef, rel, toRef, createdAt: ctx.now, createdBy: ctx.actor };
}

export const linkOps = [
  bind(contracts.linkAdd, (ctx, input) => addLink(ctx, input.from, input.rel, input.to)),

  bind(contracts.linkRemove, (ctx, input) => {
    const fromEntity = requireEntity(ctx, input.from);
    const toRef = resolveRef(ctx, input.to);
    const { changes } = ctx.sql.run("DELETE FROM links WHERE fromRef = ? AND rel = ? AND toRef = ?", [
      fromEntity.value.ref,
      input.rel,
      toRef,
    ]);
    if (changes > 0) {
      ctx.sql.run("INSERT OR IGNORE INTO link_tombstones (fromRef, rel, toRef) VALUES (?, ?, ?)", [
        fromEntity.value.ref,
        input.rel,
        toRef,
      ]);
      emit(ctx, {
        type: "link.removed",
        kind: fromEntity.kind,
        ref: fromEntity.value.ref,
        project: summarize(fromEntity).project,
        summary: `${fromEntity.value.ref} no longer ${input.rel} ${toRef}`,
        related: [toRef],
      });
    }
    return { removed: changes > 0 };
  }),

  bind(contracts.linkList, (ctx, input) => {
    const ref = resolveRef(ctx, input.ref);
    return rows(ctx, LinkRow, "SELECT * FROM links WHERE fromRef = ? OR toRef = ? ORDER BY createdAt", [
      ref,
      ref,
    ]);
  }),

  bind(contracts.linkGraph, (ctx, input) => {
    const root = resolveRef(ctx, input.ref);
    const graph = loadGraph(ctx);
    const seen = new Set([root]);
    let frontier = [root];
    for (let depth = 0; depth < (input.depth ?? 3); depth += 1) {
      const next: string[] = [];
      for (const ref of frontier) {
        for (const neighbour of graph.neighbours(ref)) {
          if (seen.has(neighbour)) continue;
          seen.add(neighbour);
          next.push(neighbour);
        }
      }
      frontier = next;
    }
    const nodes: EntitySummary[] = [...seen].flatMap((ref) => {
      const entity = findEntity(ctx, ref);
      return entity === null ? [] : [summarize(entity)];
    });
    return {
      root,
      nodes,
      edges: graph.links.filter((link) => seen.has(link.fromRef) && seen.has(link.toRef)),
    };
  }),
];
