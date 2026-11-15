import type { PullRequest } from "@octotrack/core/schemas";
import { Link } from "../ui/Link.tsx";
import { humanize, whenText } from "../../lib/format.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";

/** A pull request opened by its ref: where it lives, its checks, review and size, then what its author wrote. */
export function PrPanel({ pr }: { pr: PullRequest }) {
  return (
    <Stack>
      <Pairs
        pairs={[
          [
            "GitHub",
            <Link key="url" href={pr.url} external>
              {pr.repo}#{pr.number}
            </Link>,
          ],
          ["Checks", <StatusBadge key="checks" value={pr.checks} />],
          ["Review", <StatusBadge key="review" value={pr.review} />],
          ["Mergeable", humanize(pr.mergeable)],
          ["Branch", pr.baseRef === "" ? pr.headRef : `${pr.headRef} → ${pr.baseRef}`],
          ["Size", `+${pr.additions} -${pr.deletions}`],
          ["Author", pr.author],
          ["Synced", pr.syncedAt === null ? null : whenText(pr.syncedAt)],
        ]}
      />
      {pr.body === "" ? null : <Markdown text={pr.body} />}
    </Stack>
  );
}
