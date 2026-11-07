import type { PullRequest } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { KeyValues } from "./KeyValues.tsx";

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
          ["Synced", pr.syncedAt?.slice(0, 16).replace("T", " ")],
        ]}
      />
      {pr.body === "" ? null : <p className="prose">{pr.body}</p>}
    </>
  );
}
