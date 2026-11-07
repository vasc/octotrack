import type { z } from "zod";
import type { SqlDriver, SqlValue } from "../db/driver.ts";
import type { Channel, Drift } from "../schemas.ts";

export interface Ctx {
  sql: SqlDriver;
  actor: string;
  channel: Channel;
  now: string;
  /** Drift opened during the current write, reported back to the writer. */
  openedDrift: Drift[];
  /** Set by an operation that normally stays quiet, when this time it changed something a person can see. */
  visibleChange: boolean;
}

export function rows<S extends z.ZodType>(
  ctx: Ctx,
  schema: S,
  sql: string,
  params: readonly SqlValue[] = [],
): z.output<S>[] {
  return ctx.sql.all(sql, params).map((row) => schema.parse(row));
}

export function one<S extends z.ZodType>(
  ctx: Ctx,
  schema: S,
  sql: string,
  params: readonly SqlValue[] = [],
): z.output<S> | null {
  const [row] = ctx.sql.all(sql, params);
  return row === undefined ? null : schema.parse(row);
}

export function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}
