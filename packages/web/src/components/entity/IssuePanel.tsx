import { contracts } from "@octotrack/core/contracts";
import type { Issue } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { useOpMutation } from "../../hooks/useOp.ts";
import { ISSUE_STATUSES } from "../issues/IssueRow.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { KeyValues } from "./KeyValues.tsx";

export function IssuePanel({ issue }: { issue: Issue }) {
  const update = useOpMutation(contracts.issueUpdate);
  return (
    <>
      <KeyValues
        items={[
          [
            "Status",
            <select
              key="status"
              className="select"
              aria-label="Status"
              value={issue.status}
              onChange={(event) => {
                const next = ISSUE_STATUSES.find((status) => status === event.target.value);
                if (next !== undefined) update.mutate({ refs: [issue.ref], status: next });
              }}
            >
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>,
          ],
          ["Project", <RefLink key="project" value={issue.project} />],
          ["Priority", issue.priority],
          ["Assignee", issue.assignee],
          [
            "Milestone",
            issue.milestone === null ? null : <RefLink key="milestone" value={issue.milestone} />,
          ],
          ["Labels", issue.labels.join(", ")],
          ["Created by", issue.createdBy],
        ]}
      />
      {issue.body === "" ? null : <p className="prose">{issue.body}</p>}
      {update.error === null ? null : <p className="error-text">{update.error.message}</p>}
    </>
  );
}
