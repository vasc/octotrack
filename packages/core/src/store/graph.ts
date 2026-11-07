import { OctoError } from "../errors.ts";
import type { Link } from "../schemas.ts";
import { type Ctx, rows } from "./context.ts";
import { LinkRow, RefRow } from "./rows.ts";

const OPEN_REFS_SQL = `
  SELECT ref FROM issues WHERE status NOT IN ('done', 'cancelled')
  UNION ALL SELECT ref FROM decisions WHERE status = 'open'
  UNION ALL SELECT ref FROM prs WHERE state IN ('open', 'draft')
  UNION ALL SELECT ref FROM milestones WHERE status IN ('planned', 'active')
  UNION ALL SELECT ref FROM projects WHERE status NOT IN ('done', 'archived')
  UNION ALL SELECT ref FROM ideas WHERE status IN ('captured', 'exploring', 'planned')
`;

/** A consistent picture of the dependency network for one read or one write's reconcile pass. */
export interface GraphSnapshot {
  open: ReadonlySet<string>;
  links: readonly Link[];
  blockersOf(ref: string): string[];
  openBlockersOf(ref: string): string[];
  blocking(ref: string): string[];
  from(ref: string, rel?: Link["rel"]): string[];
  to(ref: string, rel?: Link["rel"]): string[];
  neighbours(ref: string): ReadonlySet<string>;
}

export function loadGraph(ctx: Ctx): GraphSnapshot {
  const open = new Set(rows(ctx, RefRow, OPEN_REFS_SQL).map((row) => row.ref));
  const links = rows(ctx, LinkRow, "SELECT * FROM links");
  const outgoing = new Map<string, Link[]>();
  const incoming = new Map<string, Link[]>();
  for (const link of links) {
    outgoing.set(link.fromRef, [...(outgoing.get(link.fromRef) ?? []), link]);
    incoming.set(link.toRef, [...(incoming.get(link.toRef) ?? []), link]);
  }
  const fromRel = (ref: string, rel?: Link["rel"]): string[] =>
    (outgoing.get(ref) ?? [])
      .filter((link) => rel === undefined || link.rel === rel)
      .map((link) => link.toRef);
  const toRel = (ref: string, rel?: Link["rel"]): string[] =>
    (incoming.get(ref) ?? [])
      .filter((link) => rel === undefined || link.rel === rel)
      .map((link) => link.fromRef);
  return {
    open,
    links,
    from: fromRel,
    to: toRel,
    blockersOf: (ref) => toRel(ref, "blocks"),
    openBlockersOf: (ref) => toRel(ref, "blocks").filter((blocker) => open.has(blocker)),
    blocking: (ref) => fromRel(ref, "blocks"),
    neighbours: (ref) => new Set([...fromRel(ref), ...toRel(ref)]),
  };
}

/** `blocks` must stay acyclic, or nothing in the cycle could ever become ready. */
export function assertNoBlockCycle(ctx: Ctx, fromRef: string, toRef: string): void {
  if (fromRef === toRef) throw new OctoError("invalid_input", `${fromRef} cannot block itself`);
  const seen = new Set<string>();
  const stack = [toRef];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    if (current === fromRef) {
      throw new OctoError("conflict", `${fromRef} blocks ${toRef} would create a cycle`);
    }
    const next = rows(ctx, RefRow, "SELECT toRef AS ref FROM links WHERE fromRef = ? AND rel = 'blocks'", [
      current,
    ]);
    stack.push(...next.map((row) => row.ref));
  }
}
