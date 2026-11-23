import { OctoError } from "../errors.ts";
import type { Ctx } from "../store/context.ts";

/**
 * Undo, drafts, notifications, what has been seen and where the developer is belong to the developer's own screen and
 * phone: an agent making them would silence the phone or mark things read for them. Every operation on the work itself
 * is open to agents.
 */
export function requireDeveloperInPerson(ctx: Ctx, what: string): void {
  if (ctx.developer) return;
  throw new OctoError("forbidden", `Only the developer can ${what}`);
}

/** What only the server itself records: wakes, starts, sends. */
export function requireServer(ctx: Ctx): void {
  if (!ctx.system) throw new OctoError("forbidden", "Only the server records this");
}
