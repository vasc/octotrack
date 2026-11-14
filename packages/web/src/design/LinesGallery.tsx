import { LinePanel } from "../components/entity/LinePanel.tsx";
import { AddLineForm } from "../components/lines/AddLineForm.tsx";
import { LineSection } from "../components/lines/LineSection.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { line } from "./fixtures.ts";

const NOOP = () => {};
const ACTIONS = { onMove: NOOP, onTable: NOOP, onOrder: NOOP };

/** Lines of work: the sections of the Lines page and a line in the inspector. */
export function LinesGallery() {
  return (
    <DesignSection title="Lines of work">
      <Example label="Working on, two lines">
        <LineSection
          title="Working on"
          lines={[line(), line({ ref: "L-2", title: "Weekly digest", repos: [] })]}
          {...ACTIONS}
        />
      </Example>
      <Example label="A proposal, with the agent's advice, and one from before">
        <LineSection
          title="Proposed"
          lines={[
            line({
              ref: "L-3",
              title: "Wall mount",
              state: "proposed",
              proposedBy: "panel-widgets",
              recommendation: "up_next",
              recommendationWhy: "The enclosure's final print moves the mounting points.",
            }),
            line({ ref: "L-4", title: "A weekly digest", state: "proposed", repos: [], fromRef: "I-2" }),
          ]}
          {...ACTIONS}
        />
      </Example>
      <Example label="Tabled, with why and when to look again">
        <LineSection
          title="Tabled"
          lines={[
            line({
              ref: "L-5",
              title: "Podcast cleanup",
              state: "tabled",
              tabledReason: "The disk is not tight",
              lookAgainAt: "2027-02-01",
            }),
          ]}
          {...ACTIONS}
        />
      </Example>
      <Example label="An empty section that says so">
        <LineSection title="Up next" lines={[]} empty="Nothing is up next." {...ACTIONS} />
      </Example>
      <Example label="Adding a line">
        <AddLineForm onAdd={NOOP} />
      </Example>
      <Example label="A line in the inspector">
        <LinePanel line={line()} />
      </Example>
    </DesignSection>
  );
}
