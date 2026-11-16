import type { PullRequest } from "@octotrack/core/schemas";
import { ageWords, clockTime } from "../../lib/format.ts";
import { Glyph, StatusBadge } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Link } from "../ui/Link.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";

/** When it was last synced, as words after Synced: "2 min ago", or "just now". */
function syncedWords(iso: string, now: number): string {
  const age = ageWords(iso, now);
  return age === "just now" ? age : `${age} ago`;
}

/**
 * A pull request opened by its ref: its state, where it lives, who opened it and how long ago, and its size, in one
 * row of facts; then its facts, a conflict first among them; then what its author wrote.
 */
export function PrPanel({
  pr,
  now = Date.now(),
  stale,
}: {
  pr: PullRequest;
  now?: number;
  /** Sync has stopped for its repo: since when, and why. */
  stale?: { since: string; reason: string } | undefined;
}) {
  const state = pr.state.charAt(0).toUpperCase() + pr.state.slice(1);
  return (
    <Stack>
      <Facts>
        <Kind tone="none">{state}</Kind>
        <Link href={pr.url} external>
          {pr.repo}#{pr.number}
        </Link>
        {`by ${pr.author} · ${ageWords(pr.createdAt, now)}`}
        {`+${pr.additions} −${pr.deletions}`}
      </Facts>
      <Pairs
        pairs={[
          [
            "Merge",
            pr.mergeable === "conflicting" ? (
              <>
                <Glyph tone="warn">▲</Glyph> conflicts with {pr.baseRef === "" ? "its base" : pr.baseRef};{" "}
                {pr.headRef} needs a rebase
              </>
            ) : null,
          ],
          ["Checks", pr.checks === "none" ? "none run" : <StatusBadge key="checks" value={pr.checks} />],
          ["Review", pr.review === "none" ? "none asked" : <StatusBadge key="review" value={pr.review} />],
          ["Branch", pr.baseRef === "" ? pr.headRef : `${pr.headRef} → ${pr.baseRef}`],
          [
            "Synced",
            stale !== undefined
              ? `stale since ${clockTime(stale.since)}: ${stale.reason}`
              : pr.syncedAt === null || pr.syncedAt === ""
                ? null
                : syncedWords(pr.syncedAt, now),
          ],
        ]}
      />
      {pr.body === "" ? null : <Markdown text={pr.body} />}
    </Stack>
  );
}
