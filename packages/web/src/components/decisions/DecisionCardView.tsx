import type { DecisionCard } from "@octotrack/core/schemas";
import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { OwnWords } from "./OwnWords.tsx";
import { QuestionOptions } from "./QuestionOptions.tsx";
import { QuestionStrip } from "./QuestionStrip.tsx";

export interface DecisionCardViewProps {
  card: DecisionCard;
  form: DecisionForm;
  /** The one item with focus: the keys answer this question. */
  selected?: boolean;
  /** Its line's place in the order: an urgent question stands apart from its line, so it names it. */
  line?: LinePlace | null;
  /** In a line's panel: open the question on its own, with what led to it and what it connects to. */
  onBackground?: () => void;
}

/**
 * A question opened: the situation, options that say what happens, the reason for the recommendation directly under
 * them, and the answer in one press. Pure: all state comes in through `form`.
 */
export function DecisionCardView({
  card,
  form,
  selected = false,
  line = null,
  onBackground,
}: DecisionCardViewProps) {
  const { decision } = card;
  return (
    <article
      className="question"
      data-selected={selected}
      data-urgent={decision.urgentReason !== null}
      aria-label={decision.title}
    >
      <QuestionStrip card={card} line={line} />
      <h3 className="question-title">{decision.title}</h3>
      {decision.context === "" ? null : (
        <div className="question-context">
          <Markdown text={decision.context} />
        </div>
      )}
      <QuestionOptions decision={decision} onAnswer={form.answer} />
      {form.ownWords === null ? (
        <div className="question-actions">
          <button type="button" className="btn" onClick={form.openOwn}>
            In my own words
          </button>
          <button type="button" className="btn" onClick={form.postpone}>
            {decision.postponedAt === null ? "Later" : "Bring back"}
          </button>
          {onBackground === undefined ? null : (
            <button type="button" className="btn" onClick={onBackground}>
              Background
            </button>
          )}
          {decision.urgentReason === null || decision.notUrgentAt !== null ? null : (
            <button type="button" className="btn" onClick={form.notUrgent}>
              Not urgent
            </button>
          )}
        </div>
      ) : (
        <OwnWords refName={decision.ref} form={form} />
      )}
      {form.error === null ? null : (
        <p className="error-text" role="alert">
          {form.error}
        </p>
      )}
    </article>
  );
}
