import { OctoError } from "../errors.ts";
import type { Ctx } from "../store/context.ts";

/**
 * The developer's operations: placing lines, stopping agents. An agent may still make one when it quotes what the
 * developer told it, which is recorded with the event, so the developer can see whose words did it.
 */
export function requireDeveloper(ctx: Ctx, what: string): void {
  if (ctx.developer || ctx.said !== null) return;
  throw new OctoError(
    "forbidden",
    `Only the developer can ${what}`,
    'If the developer told you to, pass --said "<their words>". Otherwise propose it: octo line propose.',
  );
}

/** Undo, drafts and notifications belong to the developer in person: an agent cannot relay them with --said. */
export function requireDeveloperInPerson(ctx: Ctx, what: string): void {
  if (ctx.developer) return;
  throw new OctoError("forbidden", `Only the developer can ${what}`);
}

/** What only the server itself records: wakes, starts, sends. */
export function requireServer(ctx: Ctx): void {
  if (!ctx.system) throw new OctoError("forbidden", "Only the server records this");
}
