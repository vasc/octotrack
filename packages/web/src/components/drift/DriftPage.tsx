import { contracts } from "@octotrack/core/contracts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { FilterBox } from "../feed/FilterBox.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { DriftItem } from "./DriftItem.tsx";

export function DriftPage() {
  const filter = useFilter();
  const drift = useOpQuery(contracts.driftList, filter.query === "" ? {} : { query: filter.query });
  const ack = useOpMutation(contracts.driftAck);
  return (
    <div className="page">
      <PageHead title="Drift" />
      <p className="muted">
        Things that may be out of date. Agents clear these as they work. Add status:verified to see past
        answers.
      </p>
      <FilterBox filter={filter} placeholder="Filter: project:OCT rule:pr-checks-failing status:verified" />
      {drift.isPending ? <LoadingState /> : null}
      {drift.error === null ? null : <ErrorState error={drift.error} />}
      {drift.data?.length === 0 ? <EmptyState>Nothing is out of date.</EmptyState> : null}
      <div>
        {drift.data?.map((item) => (
          <DriftItem
            key={item.ref}
            drift={item}
            error={ack.variables?.refs?.includes(item.ref) ? (ack.error?.message ?? null) : null}
            onAck={(ref, mode, note) => ack.mutate({ refs: [ref], mode, note })}
          />
        ))}
      </div>
    </div>
  );
}
