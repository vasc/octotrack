import { OctoError } from "../errors.ts";
import type { EntityKind, EventAttrs, FieldChange } from "../schemas.ts";
import type { Ctx } from "./context.ts";
import { one, rows } from "./context.ts";
import { CountRow, ValueRow } from "./rows.ts";

export function nextNumber(ctx: Ctx, counter: string): number {
  ctx.sql.run(
    "INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = value + 1",
    [counter],
  );
  const row = one(ctx, ValueRow, "SELECT value FROM counters WHERE name = ?", [counter]);
  if (row === null) throw new OctoError("internal", `Counter ${counter} vanished`);
  return row.value;
}

export type ColumnValue = string | number | null | readonly unknown[];
export type Patch = Readonly<Record<string, ColumnValue | undefined>>;
export type Changes = Record<string, FieldChange>;

function toColumn(value: ColumnValue): string | number | null {
  return typeof value === "string" || typeof value === "number" || value === null
    ? value
    : JSON.stringify(value);
}

function sameValue(current: unknown, next: ColumnValue): boolean {
  if (Array.isArray(current) || Array.isArray(next)) return JSON.stringify(current) === JSON.stringify(next);
  return (current ?? null) === next;
}

/**
 * Applies only the fields that really changed, bumping version and updatedAt when any did.
 * Table and column names always come from code, never from input: callers build `patch` from known keys.
 */
export function applyPatch(
  ctx: Ctx,
  table: string,
  ref: string,
  current: Readonly<Record<string, unknown>>,
  patch: Patch,
): Changes {
  const changes: Changes = {};
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [column, next] of Object.entries(patch)) {
    if (next === undefined) continue;
    if (sameValue(current[column], next)) continue;
    changes[column] = { from: current[column] ?? null, to: next };
    assignments.push(`${column} = ?`);
    values.push(toColumn(next));
  }
  if (assignments.length === 0) return changes;
  ctx.sql.run(
    `UPDATE ${table} SET ${assignments.join(", ")}, version = version + 1, updatedAt = ? WHERE ref = ?`,
    [...values, ctx.now, ref],
  );
  return changes;
}

export function assertVersion(ref: string, current: number, expected: number | undefined): void {
  if (expected !== undefined && expected !== current) {
    throw new OctoError(
      "version_mismatch",
      `${ref} is at version ${current}, not ${expected}`,
      "Someone else changed it. Read it again and retry.",
    );
  }
}

export interface EmitInput {
  type: string;
  kind: EntityKind;
  ref: string;
  project: string | null;
  summary: string;
  related?: readonly string[];
  attrs?: EventAttrs;
  changes?: Changes;
}

export function emit(ctx: Ctx, event: EmitInput): void {
  ctx.sql.run(
    `INSERT INTO events (ts, actor, type, kind, ref, project, summary, related, attrs, changes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.now,
      ctx.actor,
      event.type,
      event.kind,
      event.ref,
      event.project,
      event.summary,
      JSON.stringify(event.related ?? []),
      JSON.stringify(event.attrs ?? {}),
      JSON.stringify(event.changes ?? {}),
    ],
  );
}

export function currentCursor(ctx: Ctx): number {
  return one(ctx, CountRow, "SELECT COALESCE(MAX(seq), 0) AS n FROM events")?.n ?? 0;
}

export function countOf(ctx: Ctx, sql: string, params: readonly (string | number | null)[] = []): number {
  return rows(ctx, CountRow, sql, params)[0]?.n ?? 0;
}
