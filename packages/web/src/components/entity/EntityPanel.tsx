import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { closeEntity } from "../../lib/router.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { StaleNote } from "../ui/Loaded.tsx";
import { Panel } from "../ui/Panel.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { EntityBody } from "./EntityBody.tsx";
import { EntityCrumbs } from "./EntityCrumbs.tsx";
import { EventList } from "./EventList.tsx";
import { IssuePanel } from "./IssuePanel.tsx";
import { LinePanelItem } from "./LinePanelItem.tsx";
import { LinkList } from "./LinkList.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { UpdatesSection } from "./UpdatesSection.tsx";

/** Any item, by ref: what it is, what it connects to, what is out of date about it, and how it got here. */
export function EntityPanel({ entityRef }: { entityRef: string }) {
  const detail = useOpQuery(contracts.entityShow, { ref: entityRef });
  if (detail.data === undefined) {
    return (
      <Panel onClose={closeEntity}>
        {detail.error === null ? (
          <LoadingState label={`Loading ${entityRef}`} />
        ) : (
          <ErrorState
            title={`Could not load ${entityRef}.`}
            error={detail.error}
            onRetry={() => void detail.refetch()}
          />
        )}
      </Panel>
    );
  }
  // Loaded once: a refresh that fails keeps what is shown, saying it may be out of date.
  const stale = detail.error;
  const { summary, entity, links, linked, drift, updates, history } = detail.data;
  // A line has its own panel, as E-Line draws it.
  if ("doneWhen" in entity)
    return <LinePanelItem line={entity} drift={drift} stale={stale} staleAt={detail.dataUpdatedAt} />;
  // So does an issue or task, as E-Issue draws it.
  if ("priority" in entity && "outcome" in entity)
    return <IssuePanel issue={entity} detail={detail.data} stale={stale} staleAt={detail.dataUpdatedAt} />;
  // Drift opened by its own ref is the item itself, answered from its body; the rest is what is out of date about it.
  const openDrift = drift.filter((item) => item.ref !== summary.ref);
  return (
    <Panel
      crumbs={<EntityCrumbs summary={summary} />}
      title={summary.title}
      head={<StatusBadge value={summary.status} />}
      onClose={closeEntity}
    >
      {stale === null ? null : <StaleNote at={detail.dataUpdatedAt} />}
      <EntityBody entity={entity} links={links} />
      <OpenDrift drift={openDrift} />
      <LinkList entityRef={summary.ref} links={links} linked={linked} />
      <UpdatesSection target={summary.ref} updates={updates} />
      <EventList title="History" events={history} />
    </Panel>
  );
}
