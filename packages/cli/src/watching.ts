import { contracts, type WatchResult, type WatchSpec } from "@octotrack/core";
import { type Args, parseDuration } from "./args.ts";
import { ConnectionError, type OctoClient, RemoteError } from "./client.ts";
import type { RunContext } from "./command.ts";
import { renderEvent, renderWatchResults } from "./render.ts";

export const EXIT_TIMEOUT = 124;
export const EXIT_INTERRUPTED = 130;

const HOLD_MS = 25_000;
const RETRY_MIN_MS = 200;
const RETRY_MAX_MS = 5000;

export type WaitOutcome =
  | { kind: "fired"; results: WatchResult[]; cursor: number }
  | { kind: "timeout"; cursor: number };

/**
 * Polls until a watch fires. A dropped connection is not an error: the server may just be restarting, and the watch
 * lives in its database, so the client simply keeps trying until its own deadline.
 */
export async function waitForWatches(
  client: OctoClient,
  refs: readonly string[],
  timeoutMs: number | null,
  onTick?: (results: readonly WatchResult[]) => void,
): Promise<WaitOutcome> {
  const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
  let retryDelay = RETRY_MIN_MS;
  let cursor: number | null = null;
  // Always asks at least once, so that a zero timeout is an honest "check right now".
  while (true) {
    const remaining = deadline === null ? HOLD_MS : Math.max(deadline - Date.now(), 0);
    if (remaining === 0 && cursor !== null) return { kind: "timeout", cursor };
    try {
      const response = await client.wait(refs, Math.min(remaining, HOLD_MS));
      retryDelay = RETRY_MIN_MS;
      // The watch's own position, not the end of the log: events a --count has not used up yet come before it.
      cursor = Math.min(...response.results.map((result) => result.cursor), response.cursor);
      onTick?.(response.results);
      const fired = response.results.filter((result) => result.fired);
      if (fired.length > 0) return { kind: "fired", results: fired, cursor };
      if (remaining === 0) return { kind: "timeout", cursor };
    } catch (error) {
      if (!(error instanceof ConnectionError)) throw error;
      if (remaining === 0) return { kind: "timeout", cursor: cursor ?? 0 };
      await Bun.sleep(Math.min(retryDelay, remaining));
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    }
  }
}

export function timeoutFrom(args: Args): number | null {
  const value = args.str("timeout");
  return value === undefined ? null : parseDuration(value);
}

function onInterrupt(action: () => Promise<void>): () => void {
  const handler = () => {
    void action().finally(() => process.exit(EXIT_INTERRUPTED));
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}

export interface OneShotOptions {
  spec: WatchSpec;
  timeoutMs: number | null;
  since?: number;
  count?: number;
}

async function cancelQuietly(client: OctoClient, ref: string): Promise<void> {
  try {
    await client.opInBackground(contracts.watchCancel.name, { refs: [ref] });
  } catch (error) {
    if (!(error instanceof ConnectionError || error instanceof RemoteError)) throw error;
  }
}

/** Registers a throwaway watch, hangs on it, prints what happened. Exit 0 when fired, 124 on timeout. */
export async function runOneShot(ctx: RunContext, options: OneShotOptions): Promise<number> {
  const { client, out } = ctx;
  const created = await client.call(contracts.watchCreate, {
    spec: options.spec,
    ephemeral: true,
    ...(options.since === undefined ? {} : { since: options.since }),
  });
  const ref = created.data.ref;
  const removeHandler = onInterrupt(() => cancelQuietly(client, ref));
  const outcome = await waitForWatches(client, [ref], options.timeoutMs);
  removeHandler();
  if (outcome.kind === "timeout") {
    await cancelQuietly(client, ref);
    out.data({ fired: false, reason: "timeout", watch: ref, cursor: outcome.cursor }, () => "Timed out.");
    return EXIT_TIMEOUT;
  }
  out.data({ fired: true, results: outcome.results, cursor: outcome.cursor }, () =>
    renderWatchResults(outcome.results),
  );
  return 0;
}

/** Streams every matching event as it happens. Never returns on its own, except by its timeout. */
export async function runFollow(
  ctx: RunContext,
  spec: WatchSpec,
  timeoutMs: number | null,
  since?: number,
): Promise<number> {
  const { client, out } = ctx;
  const created = await client.call(contracts.watchCreate, {
    spec,
    ephemeral: true,
    follow: true,
    ...(since === undefined ? {} : { since }),
  });
  const ref = created.data.ref;
  const removeHandler = onInterrupt(() => cancelQuietly(client, ref));
  const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
  while (true) {
    // Not stopping at zero before asking: a zero timeout means "whatever is there right now, then stop".
    const remaining = deadline === null ? null : Math.max(deadline - Date.now(), 0);
    const outcome = await waitForWatches(client, [ref], remaining);
    if (outcome.kind === "timeout") break;
    // One event can match several clauses, and should still print once, in order.
    const events = new Map(
      outcome.results
        .flatMap((result) => result.clauses.flatMap((clause) => clause.events))
        .map((event) => [event.seq, event]),
    );
    for (const event of [...events.values()].sort((a, b) => a.seq - b.seq))
      out.line(event, () => renderEvent(event));
  }
  removeHandler();
  await cancelQuietly(client, ref);
  return EXIT_TIMEOUT;
}
