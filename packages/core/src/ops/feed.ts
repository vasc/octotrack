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
}

export function listFeed(ctx: Ctx, input: FeedInput): FeedPage {
  const ast = parseQuery(combinedQuery(ctx, input.view, input.query));
  const env = matchEnv(ctx, loadGraph(ctx));
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
      if (matchQuery(ast, eventDoc(event), env)) {
        matched.push(event);
        if (matched.length === limit) break;
      }
    }
    if (batch.length < SCAN_BATCH && matched.length < limit) exhausted = true;
    if (exhausted) break;
  }

  return { events: matched, nextBefore: exhausted ? null : before, cursor: currentCursor(ctx) };
}
