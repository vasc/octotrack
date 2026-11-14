import { z } from "zod";
import type { LineState } from "../schemas.ts";
import type { Ctx } from "./context.ts";
import { one } from "./context.ts";

const RankRow = z.object({ value: z.number().nullable() });

export function edgeRank(ctx: Ctx, state: LineState, edge: "MIN" | "MAX"): number | null {
  return (
    one(ctx, RankRow, `SELECT ${edge}(rank) AS value FROM lines WHERE state = ?`, [state])?.value ?? null
  );
}

/** Just after the last line in a section: where a line moved into it goes. */
export function rankAtEnd(ctx: Ctx, state: LineState): number {
  return (edgeRank(ctx, state, "MAX") ?? 0) + 1;
}
