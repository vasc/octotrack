import { contracts } from "@octotrack/core/contracts";
import { useFilter } from "../../hooks/useFilter.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { setParams, useRoute } from "../../lib/router.ts";
import { FilterBox } from "../feed/FilterBox.tsx";
import { ListCapNote } from "../ui/ListCapNote.tsx";
import { PageHead } from "../ui/PageHead.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState, ErrorState, LoadingState } from "../ui/states.tsx";
import { BatchPanel } from "./BatchPanel.tsx";
import { DecisionRow } from "./DecisionRow.tsx";
import { QueueSection } from "./QueueSection.tsx";

const LOG_LIMIT = 200;

const LOGS = [
  { name: "All", query: "" },
  { name: "Architecture", query: "type:architecture" },
  { name: "Product", query: "type:product" },
  { name: "Out of band", query: "channel:out_of_band" },
];

export function DecisionsPage() {
  const filter = useFilter();
  const { params } = useRoute();
  const logName = params.get("log") ?? "All";
  const logQuery = LOGS.find((log) => log.name === logName)?.query ?? "";
  const history = useOpQuery(contracts.decisionList, {
    query: [`-status:open`, logQuery, filter.query].filter((part) => part !== "").join(" "),
    limit: LOG_LIMIT,
  });

  return (
    <div className="page">
      <PageHead title="Decisions" />
      <FilterBox filter={filter} placeholder="Filter: type:architecture project:OCT" />
      <QueueSection query={filter.query} isDefault={filter.query === ""} allCards />
      <BatchPanel />
      <Section title="Decision log" note={String(history.data?.length ?? "")}>
        <nav className="tabs" aria-label="Decision log">
          {LOGS.map((log) => (
            <button
              type="button"
              key={log.name}
              className="tab"
              aria-pressed={log.name === logName}
              onClick={() => setParams({ log: log.name === "All" ? null : log.name })}
            >
              {log.name}
            </button>
          ))}
        </nav>
        {history.isPending ? <LoadingState /> : null}
        {history.error === null ? null : <ErrorState error={history.error} />}
        {history.data?.length === 0 ? <EmptyState>No decisions recorded here yet.</EmptyState> : null}
        <div className="rows" style={{ marginTop: 6 }}>
          {history.data?.map((decision) => (
            <DecisionRow key={decision.ref} decision={decision} />
          ))}
        </div>
        <ListCapNote shown={history.data?.length ?? 0} cap={LOG_LIMIT} />
      </Section>
    </div>
  );
}
