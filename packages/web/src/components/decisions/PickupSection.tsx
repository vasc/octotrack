import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { Section } from "../ui/Section.tsx";
import { DecisionRow } from "./DecisionRow.tsx";

/** Answers no agent has heard yet: decided, but nothing will happen until someone picks them up. */
export function PickupSection() {
  const waiting = useOpQuery(contracts.decisionInbox, { all: true });
  if (waiting.data === undefined || waiting.data.length === 0) return null;
  return (
    <Section title="Answered, not picked up" note={String(waiting.data.length)}>
      <div className="rows rows--spaced">
        {waiting.data.map((decision) => (
          <DecisionRow key={decision.ref} decision={decision} />
        ))}
      </div>
    </Section>
  );
}
