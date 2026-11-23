import { z } from "zod";
import { contracts } from "../contracts.ts";
import { InputError, OctoError } from "../errors.ts";
import { Channel, PendingChoice } from "../schemas.ts";
import type { Ctx } from "../store/context.ts";
import { one, rows } from "../store/context.ts";
import { claimsOf } from "../store/agents.ts";
import { getLine } from "../store/entities.ts";
import { bind } from "./bind.ts";
import { requireDeveloperInPerson } from "./developer.ts";

/** Long enough to see and undo a stray key, short enough not to feel like waiting. */
export const DEFAULT_CHOICE_DELAY_MS = 5000;

const ChoiceRow = PendingChoice.omit({ ref: true, line: true }).extend({
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

const Target = z.object({ ref: z.string() });
const Retried = z.object({ line: z.string() });
const CheckedOut = z.object({ retry: z.string() });
const Stopping = z.object({ name: z.string() });
const OneOf = z.object({ refs: z.tuple([z.string()]) });

/** The ops that act on an agent by its name. */
const AGENT_OPS: ReadonlySet<string> = new Set([
  contracts.agentStop.name,
  contracts.agentLift.name,
  contracts.agentRelease.name,
]);

/**
 * What a choice is about, so home can hold that item still while it waits: the ref it names, or the one ref of a list
 * of one; for a Try now, Start
 * one anyway or Set its checkout, the line that Step in is on; for a Stop, Lift or Release, the agent, as agent:<name>.
 */
function targetOf(op: string, input: unknown): string | null {
  const target = Target.safeParse(input);
  if (target.success) return target.data.ref;
  // An answer to one drift, as the panel sends it, is about that drift.
  const one = OneOf.safeParse(input);
  if (one.success) return one.data.refs[0];
  if (AGENT_OPS.has(op)) {
    const agent = Stopping.safeParse(input);
    return agent.success ? `agent:${agent.data.name}` : null;
  }
  if (op === contracts.runnerRetry.name) {
    const retried = Retried.safeParse(input);
    return retried.success ? retried.data.line : null;
  }
  if (op === contracts.repoCheckout.name) {
    const checkedOut = CheckedOut.safeParse(input);
    return checkedOut.success ? checkedOut.data.retry : null;
  }
  return null;
}

/** The working line a Stop would leave without its owner: the first, when it owns several. */
function lineLeft(ctx: Ctx, row: ChoiceRow): string | null {
  if (row.op !== contracts.agentStop.name) return null;
  const stopping = Stopping.safeParse(JSON.parse(row.input));
  if (!stopping.success) return null;
  return (
    claimsOf(ctx, stopping.data.name).find(
      (claim) => claim.role === "owner" && getLine(ctx, claim.line)?.state === "working",
    )?.line ?? null
  );
}

function view(ctx: Ctx, row: ChoiceRow): PendingChoice {
  return {
    id: row.id,
    op: row.op,
    ref: targetOf(row.op, JSON.parse(row.input)),
    line: lineLeft(ctx, row),
    draft: row.draft,
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
    // The words went out with it, so the box they were typed in starts empty; Undo or a failure keeps them.
    if (row.draft !== null) ctx.sql.run("DELETE FROM drafts WHERE key = ?", [row.draft]);
  } catch (error) {
    // Only the tracker's own refusals are written for people; anything else, such as input the op cannot read, is said
    // plainly, since the page shows this to the developer as it is.
    ctx.sql.run("UPDATE pending_choices SET state = 'failed', error = ? WHERE id = ?", [
      error instanceof OctoError && !(error instanceof InputError)
        ? error.message
        : "The tracker could not take it as it was sent; nothing changed.",
      row.id,
    ]);
  }
  return view(ctx, requireChoice(ctx, row.id));
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
      `INSERT INTO pending_choices (op, input, actor, channel, said, summary, dueAt, state, createdAt, draft)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        input.op,
        JSON.stringify(input.input ?? {}),
        ctx.actor,
        ctx.channel,
        ctx.said,
        input.summary,
        dueAt,
        ctx.now,
        input.draft ?? null,
      ],
    );
    const id = one(ctx, z.object({ id: z.number().int() }), "SELECT last_insert_rowid() AS id")?.id ?? 0;
    ctx.visibleChange = true;
    return view(ctx, requireChoice(ctx, id));
  }),

  bind(contracts.choiceUndo, (ctx, input) => {
    requireDeveloperInPerson(ctx, "use the developer's own choices and drafts");
    const row = requireChoice(ctx, input.id);
    // A failed choice is dismissed the same way: it never happened, and the developer has read why.
    if (row.state !== "pending" && row.state !== "failed") {
      throw new OctoError("conflict", `It already ${row.state === "undone" ? "was undone" : "took effect"}`);
    }
    ctx.sql.run("UPDATE pending_choices SET state = 'undone' WHERE id = ?", [row.id]);
    ctx.visibleChange = true;
    return view(ctx, requireChoice(ctx, row.id));
  }),

  bind(contracts.choiceNow, (ctx, input) => {
    requireDeveloperInPerson(ctx, "use the developer's own choices and drafts");
    const row = requireChoice(ctx, input.id);
    if (row.state !== "pending") return view(ctx, row);
    return applyChoice(ctx, row);
  }),

  bind(contracts.choiceList, (ctx) => {
    requireDeveloperInPerson(ctx, "see the developer's waiting choices");
    return rows(
      ctx,
      ChoiceRow,
      "SELECT * FROM pending_choices WHERE state IN ('pending', 'failed') ORDER BY id",
    ).map((row) => view(ctx, row));
  }),

  bind(contracts.draftSave, (ctx, input) => {
    requireDeveloperInPerson(ctx, "use the developer's own choices and drafts");
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

  bind(contracts.draftGet, (ctx, input) => {
    requireDeveloperInPerson(ctx, "read the developer's drafts");
    return {
      key: input.key,
      text:
        one(ctx, z.object({ text: z.string() }), "SELECT text FROM drafts WHERE key = ?", [input.key])
          ?.text ?? null,
    };
  }),
];
