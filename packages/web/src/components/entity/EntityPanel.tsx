import { contracts } from "@octotrack/core/contracts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { closeEntity } from "../../lib/router.ts";
import { DriftItem } from "../drift/DriftItem.tsx";
import { Section } from "../ui/Section.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { EntityBody } from "./EntityBody.tsx";
import { EntityHeader } from "./EntityHeader.tsx";
import { HistoryList } from "./HistoryList.tsx";
import { LinkList } from "./LinkList.tsx";
import { UpdatesSection } from "./UpdatesSection.tsx";

/** Any item, by ref: what it is, what it connects to, what is out of date about it, and how it got here. */
export function EntityPanel({ entityRef }: { entityRef: string }) {
  const detail = useOpQuery(contracts.entityShow, { ref: entityRef });
  const ack = useOpMutation(contracts.driftAck);
  if (detail.isPending) return <LoadingState />;
  if (detail.error !== null) {
    return (
      <div className="detail">
        <button type="button" className="detail-close" aria-label="Close" onClick={closeEntity}>
          ✕
        </button>
        <ErrorState error={detail.error} />
      </div>
    );
  }
  const { summary, entity, links, linked, drift, updates, history } = detail.data;
  const openDrift = drift.filter((item) => item.status === "open" && item.ref !== summary.ref);
  return (
    <div className="detail">
      <EntityHeader summary={summary} />
      <EntityBody entity={entity} />
      {openDrift.length === 0 ? null : (
        <Section title="Out of date" note={String(openDrift.length)}>
          {openDrift.map((item) => (
            <DriftItem
              key={item.ref}
              drift={item}
              error={ack.variables?.refs?.includes(item.ref) ? (ack.error?.message ?? null) : null}
              onAck={(ref, mode, note) => ack.mutate({ refs: [ref], mode, note })}
            />
          ))}
        </Section>
      )}
      <LinkList entityRef={summary.ref} links={links} linked={linked} />
      <UpdatesSection target={summary.ref} updates={updates} />
      <HistoryList events={history} />
    </div>
  );
}
