import type { Decision } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";
import { KeyValues } from "../entity/KeyValues.tsx";
import { DecisionMeta } from "./DecisionMeta.tsx";

/** Why an open question is not in the developer's queue: the task it waits for, or its line not being worked on. */
function heldText(decision: Decision, waitsFor: readonly string[]): string {
  if (waitsFor.length > 0) {
    return `Held: waits for ${waitsFor.join(", ")}, which would settle it.`;
  }
  if (decision.heldAt !== null) {
    return `Held while ${decision.line ?? "its line"} is not being worked on; it reaches you when the line starts and the question is current.`;
  }
  return "Not in your queue now.";
}

/**
 * An open question that is not in the developer's queue, opened by its ref: why it is held, then the question as it
 * stands, read only, since it cannot be answered until it reaches the queue.
 */
export function HeldDecision({ decision, waitsFor }: { decision: Decision; waitsFor: readonly string[] }) {
  return (
    <>
      <DecisionMeta decision={decision} />
      <p className="panel-label" data-tone="attention">
        {heldText(decision, waitsFor)}
      </p>
      <h2 className="question-title">{decision.title}</h2>
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      {decision.options.length === 0 ? null : (
        <KeyValues
          items={decision.options.map((option) => [
            option.key === decision.recommendation ? `${option.key} (recommended)` : option.key,
            option.description === "" ? option.label : `${option.label}: ${option.description}`,
          ])}
        />
      )}
      {decision.recommendationWhy === null ? null : (
        <p className="muted">
          <Markdown text={`Why: ${decision.recommendationWhy}`} inline />
        </p>
      )}
    </>
  );
}
