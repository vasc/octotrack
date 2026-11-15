import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { closeEntity } from "../../lib/router.ts";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { EntityBody } from "./EntityBody.tsx";
import { EntityHeader } from "./EntityHeader.tsx";
import { HistoryList } from "./HistoryList.tsx";
import { LinkList } from "./LinkList.tsx";
import { IssuePanel } from "./IssuePanel.tsx";
import { LinePanelItem } from "./LinePanelItem.tsx";
import { OpenDrift } from "./OpenDrift.tsx";
import { UpdatesSection } from "./UpdatesSection.tsx";

/** Any item, by ref: what it is, what it connects to, what is out of date about it, and how it got here. */
export function EntityPanel({ entityRef }: { entityRef: string }) {
  const detail = useOpQuery(contracts.entityShow, { ref: entityRef });
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
  // A line has its own panel, as E-Line draws it.
  if ("doneWhen" in entity) return <LinePanelItem line={entity} drift={drift} />;
  // So does an issue or task, as E-Issue draws it.
  if ("priority" in entity && "outcome" in entity) return <IssuePanel issue={entity} detail={detail.data} />;
  // Drift opened by its own ref is the item itself, answered from its body; the rest is what is out of date about it.
  const openDrift = drift.filter((item) => item.ref !== summary.ref);
  return (
    <div className="detail">
      <EntityHeader summary={summary} />
      <EntityBody entity={entity} links={links} />
      <OpenDrift drift={openDrift} />
      <LinkList entityRef={summary.ref} links={links} linked={linked} />
      <UpdatesSection target={summary.ref} updates={updates} />
      <HistoryList events={history} />
    </div>
  );
}
