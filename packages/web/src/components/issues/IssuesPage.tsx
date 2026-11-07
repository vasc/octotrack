import { contracts } from "@octotrack/core/contracts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { FilterBox } from "../feed/FilterBox.tsx";
import { ListCapNote } from "../ui/ListCapNote.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { IssueGroups } from "./IssueGroups.tsx";

const ISSUE_LIMIT = 1000;

export function IssuesPage() {
  const filter = useFilter();
  const issues = useOpQuery(contracts.issueList, {
    limit: ISSUE_LIMIT,
    ...(filter.query === "" ? {} : { query: filter.query }),
  });
  const update = useOpMutation(contracts.issueUpdate);
  return (
    <div className="page">
      <PageHead title="Issues" />
      <FilterBox filter={filter} placeholder="Filter: project:OCT ready:true -status:done" />
      {issues.isPending ? <LoadingState /> : null}
      {issues.error === null ? null : <ErrorState error={issues.error} />}
      {update.error === null ? null : <ErrorState error={update.error} />}
      {issues.data?.length === 0 ? (
        <EmptyState command='octo issue create "Title" -p OCT'>No issues match.</EmptyState>
      ) : null}
      {issues.data === undefined ? null : (
        <IssueGroups cards={issues.data} onStatus={(ref, status) => update.mutate({ refs: [ref], status })} />
      )}
      <ListCapNote shown={issues.data?.length ?? 0} cap={ISSUE_LIMIT} />
    </div>
  );
}
