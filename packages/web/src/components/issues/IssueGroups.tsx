import type { IssueCard, IssueStatus } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { IssueRow } from "./IssueRow.tsx";

const ORDER: readonly IssueStatus[] = [
  "blocked",
  "in_review",
  "in_progress",
  "todo",
  "backlog",
  "done",
  "cancelled",
];

export interface IssueGroupsProps {
  cards: readonly IssueCard[];
  onStatus(ref: string, status: IssueStatus): void;
}

/** Issues by status, what is closest to needing attention first. */
export function IssueGroups({ cards, onStatus }: IssueGroupsProps) {
  return (
    <>
      {ORDER.map((status) => {
        const group = cards.filter((card) => card.issue.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="group-title">
              {humanize(status)} · {group.length}
            </h2>
            <div className="rows">
              {group.map((card) => (
                <IssueRow key={card.issue.ref} card={card} onStatus={onStatus} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
