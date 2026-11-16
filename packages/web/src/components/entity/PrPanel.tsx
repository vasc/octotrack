import type { PullRequest } from "@octotrack/core/schemas";
import { sinceText, timeAgo } from "../../lib/format.ts";
import { Glyph, StatusBadge } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Link } from "../ui/Link.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";

/**
 * A pull request opened by its ref: its state, where it lives, who opened it and how long ago, and its size, in one
 * row of facts; then its facts, a conflict first among them; then what its author wrote.
 */
export function PrPanel({ pr, now = Date.now() }: { pr: PullRequest; now?: number }) {
  const state = pr.state.charAt(0).toUpperCase() + pr.state.slice(1);
  return (
    <Stack>
      <Facts>
        <Kind tone="none">{state}</Kind>
        <Link href={pr.url} external>
          {pr.repo}#{pr.number} ↗
        </Link>
        {`by ${pr.author} · ${timeAgo(pr.createdAt, now)}`}
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
          ["Synced", pr.syncedAt === null ? null : sinceText(pr.syncedAt, now)],
        ]}
      />
      {pr.body === "" ? null : <Markdown text={pr.body} />}
    </Stack>
  );
}
