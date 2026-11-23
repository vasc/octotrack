import { NewLineSheet } from "../components/lines/NewLineSheet.tsx";
import { Actions } from "../components/ui/Actions.tsx";
import { Button } from "../components/ui/Button.tsx";
import { List } from "../components/ui/List.tsx";
import { NotDone } from "../components/ui/NotDone.tsx";
import { Row } from "../components/ui/Row.tsx";
import { KeyHelp } from "../components/home/KeyHelp.tsx";
import { TableForm } from "../components/lines/TableForm.tsx";
import { DesignSection, Example, SheetExample } from "./Example.tsx";

/** The primitives every screen is built from, and New line as a sheet made only of them. */
export function PrimitivesGallery() {
  return (
    <DesignSection title="Primitives">
      <Example label="Actions: one primary, the rest words">
        <Actions>
          <Button variant="primary">Add to up next</Button>
          <Button>Start</Button>
          <Button>Table</Button>
          <Button variant="quiet">Cancel</Button>
        </Actions>
      </Example>
      <Example label="List of rows">
        <List>
          <Row
            kind="Question · D-24"
            title="How should pacing work, given it blocks skipping in a new video?"
            note="Recommended: Fast start + skip"
            onOpen={() => {}}
          />
          <Row
            kind="Task · PANEL-1"
            title="Measure the board and its holes"
            note="at the bench"
            onOpen={() => {}}
          />
          <Row
            kind="Step in · L-3"
            tone="stuck"
            title="Team offsite"
            note="no owner: no start command is set"
          />
          <Row title="video-agent" note="quiet · no line · 4d" trailing={<Button>Stop</Button>} />
        </List>
      </Example>
      <Example label="A change that did not take">
        <NotDone>Plan not changed: the tracker did not answer.</NotDone>
      </Example>
      <SheetExample label="New line">
        {(close) => (
          <NewLineSheet
            repos={["PANEL", "OCT", "MEALS"]}
            draft={{ title: "Back up the database host nightly", doneWhen: "" }}
            onDraft={() => {}}
            onAdd={close}
            onCancel={close}
          />
        )}
      </SheetExample>
      <SheetExample label="Table a line">
        {(close) => (
          <TableForm
            title="Wall mount"
            held={{ questions: 1, tasks: 1 }}
            owner="panel-widgets"
            onTable={close}
            onCancel={close}
          />
        )}
      </SheetExample>
      <SheetExample label="Keys">{(close) => <KeyHelp onClose={close} />}</SheetExample>
    </DesignSection>
  );
}
