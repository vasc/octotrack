import { BatchPanelView } from "../components/decisions/BatchPanelView.tsx";
import { DecisionCardView } from "../components/decisions/DecisionCardView.tsx";
import { DesignSection, Example, SheetExample } from "./Example.tsx";
import { decision, decisionCard, decisionForm } from "./fixtures.ts";

const NOOP = () => {};
const REASONS = ["2 agents waiting", "blocks 3 open items", "high priority"];

/** The loudest thing in the product, in each state it can be in. */
export function DecisionGallery() {
  return (
    <DesignSection title="Decisions">
      <Example label="Open, nothing chosen yet">
        <DecisionCardView form={decisionForm()} card={decisionCard({ reasons: REASONS })} />
      </Example>
      <Example label="Answering in your own words">
        <DecisionCardView
          form={decisionForm({ ownWords: "Redis, but behind a flag" })}
          card={decisionCard()}
        />
      </Example>
      <Example label="No options: the answer is typed">
        <DecisionCardView
          form={decisionForm()}
          card={decisionCard({
            decision: decision({
              title: "OK to drop Safari 15?",
              kind: "approval",
              options: [],
              recommendation: null,
            }),
          })}
        />
      </Example>
      <Example label="Words not saved yet">
        <DecisionCardView form={decisionForm({ notSaved: true })} card={decisionCard()} />
      </Example>
      <SheetExample label="Record answers">
        {(close) => (
          <BatchPanelView
            text={"D-3 redis Agreed on the call\nD-4 nope"}
            parsed={[{ ref: "D-3", option: "redis", note: "Agreed on the call" }]}
            parseError={null}
            results={[
              { ref: "D-3", ok: true, error: null },
              { ref: "D-4", ok: false, error: 'D-4 has no option "nope"' },
            ]}
            submitting={false}
            onChange={NOOP}
            onSubmit={close}
            onClose={close}
          />
        )}
      </SheetExample>
    </DesignSection>
  );
}
