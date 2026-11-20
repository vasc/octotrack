import type { LineView } from "../../hooks/useLineView.ts";
import { moreSinceSummary } from "../../lib/log.ts";
import { Loaded } from "../ui/Loaded.tsx";
import { SinceSummary } from "./SinceSummary.tsx";

/** What happened on a line since its summary, and the line in the Log. */
export function LineSince({ view }: { view: LineView }) {
  const { since, line } = view;
  return (
    <Loaded
      loaded={since.data !== undefined}
      error={since.error}
      what="what happened"
      onRetry={() => void since.refetch()}
      at={since.dataUpdatedAt}
    >
      <SinceSummary
        line={line.ref}
        events={since.data?.events ?? []}
        summaryAt={line.summaryAt}
        seenAt={view.seenAt}
        more={moreSinceSummary(since.data?.events ?? [], line.summaryAt, since.data?.nextBefore ?? null)}
      />
    </Loaded>
  );
}
