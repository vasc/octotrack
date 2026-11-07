import { contracts } from "@octotrack/core/contracts";
import { useBootstrap } from "../../hooks/useBootstrap.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { WatchRow } from "../agents/WatchRow.tsx";
import { PrRow } from "../prs/PrRow.tsx";
import { SyncFailures } from "../prs/SyncFailures.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Section } from "../ui/Section.tsx";

const RAIL_DRIFT = 6;

/** What stays in view beside the feed: PR status, anything out of date, and who is waiting. */
export function RailOverview() {
  const { data } = useBootstrap();
  const drift = useOpQuery(contracts.driftList, { limit: RAIL_DRIFT });
  const open = data?.prs.filter((card) => card.pr.state === "open" || card.pr.state === "draft") ?? [];
  const finished = data?.prs.filter((card) => card.pr.state === "merged" || card.pr.state === "closed") ?? [];
  const waiting = data?.watches ?? [];
  return (
    <>
      <Section title="Pull requests" note={String(open.length)} linkTo="/prs">
        <SyncFailures failures={data?.syncFailures ?? []} />
        {open.length === 0 ? <p className="muted">No open pull requests.</p> : null}
        <div className="rows">
          {open.map((card) => (
            <PrRow key={card.pr.ref} card={card} />
          ))}
          {finished.slice(0, 3).map((card) => (
            <PrRow key={card.pr.ref} card={card} />
          ))}
        </div>
      </Section>
      {waiting.length === 0 ? null : (
        <Section title="Agents waiting" note={String(waiting.length)} linkTo="/agents">
          <div className="rows">
            {waiting.map((watch) => (
              <WatchRow key={watch.ref} watch={watch} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Drift" note={String(data?.counts.openDrift ?? "")} linkTo="/drift">
        {drift.data?.length === 0 ? <p className="muted">Nothing is out of date.</p> : null}
        <div className="rows">
          {drift.data?.map((item) => (
            <div className="row" key={item.ref}>
              <RefLink value={item.ref} />
              <span className="row-stack">
                <span>
                  <RefText text={item.message} />
                </span>
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
