import { BatchPanelView } from "../components/decisions/BatchPanelView.tsx";
import { DeliveryBadge } from "../components/decisions/DeliveryBadge.tsx";
import { DecisionCardView } from "../components/decisions/DecisionCardView.tsx";
import { QueueRest } from "../components/decisions/QueueRest.tsx";
import { DesignSection, Example } from "./Example.tsx";
import { decision, decisionCard, decisionForm } from "./fixtures.ts";

const NOOP = () => {};
const REASONS = ["2 agents waiting", "blocks 3 open items", "high priority"];

/** The loudest thing in the product, in each state it can be in. */
export function DecisionGallery() {
  return (
    <DesignSection title="Decisions">
      <Example label="Open, nothing chosen yet">
        <DecisionCardView selected form={decisionForm()} card={decisionCard({ reasons: REASONS })} />
      </Example>
      <Example label="An option chosen, ready to confirm">
        <DecisionCardView
          form={decisionForm({ chosen: "redis", canSubmit: true, note: "Already deployed" })}
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
      <Example label="Refused by the server">
        <DecisionCardView
          form={decisionForm({ chosen: "sqs", canSubmit: true, error: 'D-1 has no option "sqs"' })}
          card={decisionCard()}
        />
      </Example>
      <Example label="What became of an answer">
        <DeliveryBadge decision={decision({ status: "decided", decidedBy: "dev" })} />
        <DeliveryBadge
          decision={decision({ status: "decided", decidedBy: "dev", wakeError: "No adapter" })}
        />
        <DeliveryBadge
          decision={decision({ status: "decided", decidedBy: "dev", pickedUpAt: "2026-11-07" })}
        />
        <DeliveryBadge
          decision={decision({ status: "decided", decidedBy: "dev", reportStatus: "partial" })}
        />
        <DeliveryBadge decision={decision({ status: "decided", decidedBy: "dev", reportStatus: "done" })} />
      </Example>
      <Example label="Closed, in the queue">
        <QueueRest card={decisionCard({ reasons: ["1 agent waiting"] })} onOpen={NOOP} />
      </Example>
      <Example label="Logging decisions made elsewhere">
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
          onSubmit={NOOP}
        />
      </Example>
    </DesignSection>
  );
}
