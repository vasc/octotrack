import { z } from "zod";
import { DEVELOPER } from "../agents/state.ts";
import { OctoError } from "../errors.ts";
import { matchQuery, parseQuery } from "../query/index.ts";
import type { FeedEvent, FeedPage } from "../schemas.ts";
import { currentCursor } from "../store/common.ts";
import { type Ctx, one, rows } from "../store/context.ts";
import { eventDoc, matchEnv } from "../store/docs.ts";
import { loadGraph } from "../store/graph.ts";
import { EventRow, ViewRow } from "../store/rows.ts";

const SCAN_BATCH = 500;
/** Bounds one request. A rare filter gets a page cursor back and can keep going, instead of a slow response. */
const SCAN_LIMIT = 5000;

export function combinedQuery(ctx: Ctx, view: string | undefined, query: string | undefined): string {
  const parts: string[] = [];
  if (view !== undefined) {
    const found = one(ctx, ViewRow, "SELECT * FROM views WHERE name = ? COLLATE NOCASE", [view]);
    if (found === null) {
      throw new OctoError("not_found", `No saved view named "${view}"`, "Run `octo view list` to see them.");
    }
    if (found.query.trim() !== "") parts.push(`(${found.query})`);
  }
  if (query !== undefined && query.trim() !== "") parts.push(`(${query})`);
  return parts.join(" ");
}

export interface FeedInput {
  query?: string;
  view?: string;
  before?: number;
  after?: number;
  limit?: number;
  unseen?: boolean;
}

const SeenRow = z.object({ ref: z.string(), seenAt: z.string().nullable() });

/** Rule breaks: they stay not seen until Mark all seen, so opening the line they broke a rule on does not hide them. */
const RULE_BREAKS: ReadonlySet<string> = new Set([
  "write.refused",
  "agent.would_stop",
  "agent.stopped",
  "pr.after_wind_down",
]);

/** When the developer last marked everything seen: changes on no line and rule breaks are not seen after it. */
export const LOG_SEEN_KEY = "logSeenAt";

/**
 * Not seen: a change made by someone else after the developer last looked. On a line, that is opening the line; for a
 * change on no line, or a rule break, only Mark all seen counts, since there is no line to open.
 */
function unseenTest(ctx: Ctx): (event: FeedEvent) => boolean {
  const seen = new Map(
    rows(ctx, SeenRow, "SELECT ref, seenAt FROM lines").map((line) => [line.ref, line.seenAt]),
  );
  const logSeenAt =
    one(ctx, z.object({ value: z.string() }), "SELECT value FROM developer_state WHERE key = ?", [
      LOG_SEEN_KEY,
    ])?.value ?? null;
  return (event) => {
    if (event.actor === DEVELOPER) return false;
    if (event.line === null || RULE_BREAKS.has(event.type)) return logSeenAt === null || event.ts > logSeenAt;
    const at = seen.get(event.line);
    return at === undefined ? false : at === null || event.ts > at;
  };
}

export function listFeed(ctx: Ctx, input: FeedInput): FeedPage {
  const ast = parseQuery(combinedQuery(ctx, input.view, input.query));
  const env = matchEnv(ctx, loadGraph(ctx));
  const unseen = input.unseen === true ? unseenTest(ctx) : () => true;
  const limit = input.limit ?? 50;
  const after = input.after ?? 0;
  const matched: FeedEvent[] = [];
  let before = input.before ?? Number.MAX_SAFE_INTEGER;
  let scanned = 0;
  let exhausted = false;

  while (matched.length < limit && scanned < SCAN_LIMIT) {
    const batch = rows(
      ctx,
      EventRow,
      "SELECT * FROM events WHERE seq < ? AND seq > ? ORDER BY seq DESC LIMIT ?",
      [before, after, SCAN_BATCH],
    );
    if (batch.length === 0) {
      exhausted = true;
      break;
    }
    for (const event of batch) {
      scanned += 1;
      before = event.seq;
      if (unseen(event) && matchQuery(ast, eventDoc(event), env)) {
        matched.push(event);
        if (matched.length === limit) break;
      }
    }
    if (batch.length < SCAN_BATCH && matched.length < limit) exhausted = true;
    if (exhausted) break;
  }

  return { events: matched, nextBefore: exhausted ? null : before, cursor: currentCursor(ctx) };
}
