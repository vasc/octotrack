import { useLines } from "../../hooks/useLines.ts";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { PageHead } from "../ui/PageHead.tsx";
import { ErrorState, LoadingState } from "../ui/states.tsx";
import { AddLineForm } from "./AddLineForm.tsx";
import { LineSection } from "./LineSection.tsx";

/** Every line of work, section by section, in the developer's order. */
export function LinesPage() {
  const lines = useLines();
  const home = lines.home.data;
  const actions = {
    onMove: lines.move,
    onTable: lines.table,
    onOrder: lines.reorder,
    ...(home === undefined ? {} : { crews: home.crews }),
  };
  return (
    <div className="page">
      <PageHead title="Lines" />
      <AddLineForm onAdd={lines.add} />
      {lines.failure === null ? null : <ErrorState error={lines.failure} />}
      {lines.home.isPending ? <LoadingState /> : null}
      {lines.home.error === null ? null : <ErrorState error={lines.home.error} />}
      {home === undefined ? null : (
        <>
          <LineSection
            title={LINE_STATE_LABEL.working}
            lines={home.working}
            empty="Nothing is being worked on."
            {...actions}
          />
          <LineSection
            title={LINE_STATE_LABEL.up_next}
            lines={home.upNext}
            empty="Nothing is up next."
            {...actions}
          />
          <LineSection title={LINE_STATE_LABEL.proposed} lines={home.proposed} {...actions} />
          <LineSection title={LINE_STATE_LABEL.tabled} lines={home.tabled} {...actions} />
          <LineSection title="Done lately" lines={home.doneLately} {...actions} />
        </>
      )}
    </div>
  );
}
