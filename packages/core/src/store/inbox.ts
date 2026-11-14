import { z } from "zod";
import type { Notice } from "../schemas.ts";
import { claimOf, claimsOn } from "./agents.ts";
import type { Ctx } from "./context.ts";
import { rows } from "./context.ts";
import { getIssue } from "./entities.ts";

export const InboxKind = z.enum(["answer", "tell", "task_done", "task_cant"]);
export type InboxKind = z.infer<typeof InboxKind>;

const InboxRow = z.object({
  id: z.number().int(),
  line: z.string(),
  kind: InboxKind,
  ref: z.string().nullable(),
  issue: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});
export type InboxItem = z.infer<typeof InboxRow>;

/** Something sent to a line, not to an agent: it waits until someone on the line can act on it. */
export function addToInbox(
  ctx: Ctx,
  line: string,
  kind: InboxKind,
  ref: string | null,
  issue: string | null,
  body: string,
): void {
  ctx.sql.run("INSERT INTO line_inbox (line, kind, ref, issue, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)", [
    line,
    kind,
    ref,
    issue,
    body,
    ctx.now,
  ]);
}

/** Who an item is for right now: whoever holds the issue it concerns, if they are on the line, else the line's owner. */
export function recipientOf(ctx: Ctx, item: InboxItem): string | null {
  if (item.issue !== null) {
    const holder = getIssue(ctx, item.issue)?.assignee ?? null;
    if (holder !== null && claimOf(ctx, holder)?.line === item.line) return holder;
  }
  return claimsOn(ctx, item.line).find((claim) => claim.role === "owner")?.agent ?? null;
}

export function pendingInbox(ctx: Ctx, line: string): InboxItem[] {
  return rows(ctx, InboxRow, "SELECT * FROM line_inbox WHERE line = ? AND deliveredAt IS NULL ORDER BY id", [
    line,
  ]);
}

/** The items waiting for this agent on its line. */
export function inboxFor(ctx: Ctx, agent: string): InboxItem[] {
  const claim = claimOf(ctx, agent);
  if (claim === null) return [];
  return pendingInbox(ctx, claim.line).filter((item) => recipientOf(ctx, item) === agent);
}

/** Hands this agent its items, once, as notices on the reply that carries them. */
export function takeInbox(ctx: Ctx, agent: string): Notice[] {
  return inboxFor(ctx, agent).map((item) => {
    ctx.sql.run("UPDATE line_inbox SET deliveredTo = ?, deliveredAt = ? WHERE id = ?", [
      agent,
      ctx.now,
      item.id,
    ]);
    return {
      id: null,
      agent,
      kind: item.kind,
      line: item.line,
      body: item.body,
      wakes: true,
      createdAt: item.createdAt,
    };
  });
}
