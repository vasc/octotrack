import { whenText } from "../../lib/format.ts";
import type { PullRequest } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { KeyValues } from "./KeyValues.tsx";
import { Markdown } from "../ui/Markdown.tsx";

export function PrPanel({ pr }: { pr: PullRequest }) {
  return (
    <>
      <KeyValues
        items={[
          [
            "GitHub",
            <a key="url" href={pr.url} target="_blank" rel="noreferrer">
              {pr.repo}#{pr.number}
            </a>,
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
    </>
  );
}
