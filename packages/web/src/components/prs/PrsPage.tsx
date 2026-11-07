import { contracts } from "@octotrack/core/contracts";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useGithubSync } from "../../hooks/useGithubSync.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { FilterBox } from "../feed/FilterBox.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { ListCapNote } from "../ui/ListCapNote.tsx";
import { PrRow } from "./PrRow.tsx";
import { SyncFailures } from "./SyncFailures.tsx";

const PR_LIMIT = 200;

export function PrsPage() {
  const filter = useFilter();
  const sync = useGithubSync();
  const { data: bootstrap } = useBootstrap();
  const prs = useOpQuery(
    contracts.prList,
    filter.query === "" ? { limit: PR_LIMIT } : { query: filter.query, limit: PR_LIMIT },
  );

  return (
    <div className="page">
      <PageHead title="Pull requests">
        <button type="button" className="btn" disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? "Syncing..." : "Sync from GitHub"}
        </button>
      </PageHead>
      {sync.error === null ? null : <ErrorState error={sync.error} />}
      <SyncFailures failures={bootstrap?.syncFailures ?? []} />
      <FilterBox filter={filter} placeholder="Filter: state:open checks:failing repo:acme/app" />
      {prs.isPending ? <LoadingState /> : null}
      {prs.error === null ? null : <ErrorState error={prs.error} />}
      {prs.data?.length === 0 ? (
        <EmptyState command="octo project update OCT --repo owner/name">
          No pull requests. Give a project a repo and they are tracked automatically.
        </EmptyState>
      ) : null}
      <div className="rows">
        {prs.data?.map((card) => (
          <PrRow key={card.pr.ref} card={card} wide />
        ))}
      </div>
      <ListCapNote shown={prs.data?.length ?? 0} cap={PR_LIMIT} />
    </div>
  );
}
