import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { closeEntity } from "../../lib/router.ts";
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
import { useBackTo } from "../../hooks/useBackTo.ts";
import { useHome } from "../../hooks/useHome.ts";
import { homeLines } from "../../lib/lines.ts";
import { ApiError } from "../../api/client.ts";
import { notFoundTitle, RefNotFound } from "./RefNotFound.tsx";
import { useBootstrap } from "../../hooks/useBootstrap.ts";

/** Any item, by ref: what it is, what it connects to, what is out of date about it, and how it got here. */
export function EntityPanel({ entityRef }: { entityRef: string }) {
  const detail = useOpQuery(contracts.entityShow, { ref: entityRef });
  // Opened from another peek: Back returns there.
  const back = useBackTo();
  const h = useHome();
  const failures = useBootstrap().data?.syncFailures ?? [];
  const lines = homeLines(h.home.data);
  const retry = () => void detail.refetch();
  if (detail.data === undefined) {
    // A ref nothing answers to: said as such, not as a failure to load.
    if (detail.error instanceof ApiError && detail.error.code === "not_found") {
      return (
        <Panel onClose={closeEntity} title={notFoundTitle(entityRef)}>
          <RefNotFound refName={entityRef} />
        </Panel>
      );
    }
    // A line home already knows draws its head at once, while the rest of it loads.
    const known = h.lineOf(entityRef);
    if (known !== null && detail.error === null) {
      return <LinePanelItem line={known} drift={[]} stale={null} />;
    }
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
    return (
      <LinePanelItem
        line={entity}
        drift={drift}
        stale={stale}
        staleAt={detail.dataUpdatedAt}
        onRetry={retry}
      />
    );
  // So does an issue or task, as E-Issue draws it.
  if ("priority" in entity && "outcome" in entity)
    return (
      <IssuePanel
        issue={entity}
        detail={detail.data}
        stale={stale}
        staleAt={detail.dataUpdatedAt}
        onRetry={retry}
      />
    );
  // An old idea or milestone that became a line opens as that line: its ref leads to what it became.
  const became = "doneWhen" in entity ? undefined : lines.find((line) => line.fromRef === summary.ref);
  if (became !== undefined) return <LinePanelItem line={became} drift={[]} stale={null} />;
  // Drift opened by its own ref is the item itself, answered from its body; the rest is what is out of date about it.
  const openDrift = drift.filter((item) => item.ref !== summary.ref);
  return (
    <Panel
      crumbs={<EntityCrumbs summary={summary} drift={"rule" in entity ? entity : undefined} />}
      title={summary.title}
      onClose={closeEntity}
      back={back}
    >
      {stale === null ? null : <StaleNote at={detail.dataUpdatedAt} what={summary.ref} onRetry={retry} />}
      <EntityBody entity={entity} links={links} lines={lines} syncFailures={failures} />
      <OpenDrift drift={openDrift} />
      <LinkList entityRef={summary.ref} links={links} linked={linked} />
      <UpdatesSection target={summary.ref} updates={updates} />
      <EventList title="Activity" events={history} />
    </Panel>
  );
}
