import { z } from "zod";
import { contracts } from "../contracts.ts";
import { OctoError } from "../errors.ts";
import { Channel, PendingChoice } from "../schemas.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { bind } from "./bind.ts";

/** Long enough to see and undo a stray key, short enough not to feel like waiting. */
export const DEFAULT_CHOICE_DELAY_MS = 5000;

const ChoiceRow = PendingChoice.extend({
  input: z.string(),
  actor: z.string(),
  channel: Channel,
  said: z.string().nullable(),
});
type ChoiceRow = z.infer<typeof ChoiceRow>;

const WRITES: ReadonlySet<string> = new Set(
  Object.values(contracts)
    .filter(
      (contract) =>
        contract.mutates && !contract.name.startsWith("choice.") && !contract.name.startsWith("draft."),
    )
    .map((contract) => contract.name),
);

function view(row: ChoiceRow): PendingChoice {
  return {
    id: row.id,
    op: row.op,
    summary: row.summary,
    dueAt: row.dueAt,
    state: row.state,
    error: row.error,
    createdAt: row.createdAt,
  };
}

function requireChoice(ctx: Ctx, id: number): ChoiceRow {
  const row = one(ctx, ChoiceRow, "SELECT * FROM pending_choices WHERE id = ?", [id]);
  if (row === null) throw new OctoError("not_found", `No choice ${id}`);
  return row;
}

/**
 * Applies one waiting choice as whoever made it, in a savepoint of its own: a choice that fails is recorded as failed,
 * with why, instead of undoing anything else.
 */
export function applyChoice(ctx: Ctx, row: ChoiceRow): PendingChoice {
  ctx.sql.run("UPDATE pending_choices SET state = 'applied' WHERE id = ?", [row.id]);
  try {
    ctx.sql.transaction(() =>
      ctx.runOp(row.op, JSON.parse(row.input), { actor: row.actor, channel: row.channel, said: row.said }),
    );
  } catch (error) {
    ctx.sql.run("UPDATE pending_choices SET state = 'failed', error = ? WHERE id = ?", [
      error instanceof Error ? error.message : String(error),
      row.id,
    ]);
  }
  return view(requireChoice(ctx, row.id));
}

export function dueChoices(ctx: Ctx): ChoiceRow[] {
  return rows(
    ctx,
    ChoiceRow,
    "SELECT * FROM pending_choices WHERE state = 'pending' AND dueAt <= ? ORDER BY id",
    [ctx.now],
  );
}

export const choiceOps = [
  bind(contracts.choiceMake, (ctx, input) => {
    if (!ctx.developer) throw new OctoError("forbidden", "Only the developer's own choices wait with Undo");
    if (!WRITES.has(input.op))
      throw new OctoError("invalid_input", `${input.op} is not a choice that changes anything`);
    const dueAt = new Date(Date.parse(ctx.now) + (input.delayMs ?? DEFAULT_CHOICE_DELAY_MS)).toISOString();
    ctx.sql.run(
      `INSERT INTO pending_choices (op, input, actor, channel, said, summary, dueAt, state, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        input.op,
        JSON.stringify(input.input ?? {}),
        ctx.actor,
        ctx.channel,
        ctx.said,
        input.summary,
        dueAt,
        ctx.now,
      ],
    );
    const id = one(ctx, z.object({ id: z.number().int() }), "SELECT last_insert_rowid() AS id")?.id ?? 0;
    ctx.visibleChange = true;
    return view(requireChoice(ctx, id));
  }),

  bind(contracts.choiceUndo, (ctx, input) => {
    const row = requireChoice(ctx, input.id);
    if (row.state !== "pending")
      throw new OctoError("conflict", `It already ${row.state === "undone" ? "was undone" : "took effect"}`);
    ctx.sql.run("UPDATE pending_choices SET state = 'undone' WHERE id = ?", [row.id]);
    ctx.visibleChange = true;
    return view(requireChoice(ctx, row.id));
  }),

  bind(contracts.choiceNow, (ctx, input) => {
    const row = requireChoice(ctx, input.id);
    if (row.state !== "pending") return view(row);
    return applyChoice(ctx, row);
  }),

  bind(contracts.choiceList, (ctx) =>
    rows(ctx, ChoiceRow, "SELECT * FROM pending_choices WHERE state = 'pending' ORDER BY id").map(view),
  ),

  bind(contracts.draftSave, (ctx, input) => {
    if (input.text.trim() === "") {
      ctx.sql.run("DELETE FROM drafts WHERE key = ?", [input.key]);
      return { key: input.key, text: null };
    }
    ctx.sql.run(
      "INSERT INTO drafts (key, text, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET text = excluded.text, updatedAt = excluded.updatedAt",
      [input.key, input.text, ctx.now],
    );
    return { key: input.key, text: input.text };
  }),

  bind(contracts.draftGet, (ctx, input) => ({
    key: input.key,
    text:
      one(ctx, z.object({ text: z.string() }), "SELECT text FROM drafts WHERE key = ?", [input.key])?.text ??
      null,
  })),
];
