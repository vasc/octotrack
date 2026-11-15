import type { Decision } from "@octotrack/core/schemas";
import { DecisionOptions } from "../entity/DecisionOptions.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { RefText } from "../ui/RefText.tsx";
import { DecisionMeta } from "./DecisionMeta.tsx";

/** Why an open question is not in the developer's queue: the task it waits for, or its line not being worked on. */
function heldText(decision: Decision, waitsFor: readonly string[]): string {
  if (waitsFor.length > 0) return `held: waits for ${waitsFor.join(", ")}`;
  if (decision.heldAt !== null) return "held until its line starts";
  return "not in your queue";
}

/**
 * An open question that is not in the developer's queue, opened by its ref: why it is held, then the question as it
 * stands, read only, since it cannot be answered until it reaches the queue.
 */
export function HeldDecision({ decision, waitsFor }: { decision: Decision; waitsFor: readonly string[] }) {
  return (
    <>
      <DecisionMeta decision={decision} />
      <Note>
        <RefText text={heldText(decision, waitsFor)} />
      </Note>
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      <DecisionOptions options={decision.options} marked={decision.recommendation} mark="recommended" />
      {decision.recommendationWhy === null ? null : (
        <Note>
          <Markdown text={`Why: ${decision.recommendationWhy}`} inline />
        </Note>
      )}
    </>
  );
}
