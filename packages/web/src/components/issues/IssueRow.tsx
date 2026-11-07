import type { IssueCard, IssueStatus } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";

export const ISSUE_STATUSES: readonly IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export interface IssueRowProps {
  card: IssueCard;
  onStatus(ref: string, status: IssueStatus): void;
}

export function IssueRow({ card, onStatus }: IssueRowProps) {
  const { issue } = card;
  return (
    <div className="row">
      <RefLink value={issue.ref} />
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(issue.ref)}>
          {issue.title}
        </button>
        {card.blockedBy.length > 0 || card.prs.length > 0 || issue.labels.length > 0 ? (
          <div className="row-sub">
            {card.blockedBy.length === 0 ? null : (
              <>
                <span>blocked by</span>
                {card.blockedBy.map((ref) => (
                  <RefLink key={ref} value={ref} />
                ))}
              </>
            )}
            {card.prs.map((ref) => (
              <RefLink key={ref} value={ref} />
            ))}
            {issue.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}
      </div>
      {card.openDrift > 0 ? <Badge tone="warn">{card.openDrift} drift</Badge> : null}
      {issue.priority === "medium" || issue.priority === "none" ? null : (
        <StatusBadge value={issue.priority} />
      )}
      {issue.assignee === null ? null : <span className="muted">{issue.assignee}</span>}
      <select
        className="select"
        aria-label={`Status of ${issue.ref}`}
        value={issue.status}
        onChange={(event) => {
          const next = ISSUE_STATUSES.find((status) => status === event.target.value);
          if (next !== undefined) onStatus(issue.ref, next);
        }}
      >
        {ISSUE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {humanize(status)}
          </option>
        ))}
      </select>
    </div>
  );
}
