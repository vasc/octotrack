import type { DecisionCard } from "@octotrack/core/schemas";
import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TextBox } from "../ui/TextBox.tsx";

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
  const recommendedAt = decision.options.findIndex((option) => option.key === decision.recommendation);
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  const columns = Math.min(Math.max(decision.options.length, 1), 3);
  return (
    <article
      className="question"
      data-selected={selected}
      data-urgent={decision.urgentReason !== null}
      aria-label={decision.title}
    >
      <div className="question-strip">
        {selected ? <span className="question-focused">Focused</span> : null}
        {decision.urgentReason === null ? (
          <span className="question-kind">Question</span>
        ) : (
          <>
            <span className="question-kind">Urgent</span>
            <span className="question-kind">{capitalized(URGENT_REASON[decision.urgentReason])}</span>
          </>
        )}
        {decision.urgentReason !== null && line !== null ? (
          <span>
            {line.number === null ? "" : `${line.number} · `}
            {line.title} · <RefLink value={decision.ref} />
          </span>
        ) : (
          <RefLink value={decision.ref} />
        )}
        {decision.urgentReason !== null ? null : openWork.length === 0 ? (
          <span>asked by {decision.requestedBy}</span>
        ) : (
          <span>
            holds up{" "}
            {openWork.map((item) => (
              <RefLink key={item.ref} value={item.ref} />
            ))}
          </span>
        )}
        {decision.postponedAt === null ? null : <span>later</span>}
        {card.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
      </div>
      <h3 className="question-title">{decision.title}</h3>
      {decision.context === "" ? null : (
        <div className="question-context">
          <Markdown text={decision.context} />
        </div>
      )}
      {decision.options.length === 0 ? null : (
        <div className="question-options" data-columns={columns}>
          {decision.options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              className="question-option"
              data-recommended={option.key === decision.recommendation}
              onClick={() => form.answer(option.key)}
            >
              <span className="question-option-head">
                <b>
                  {index + 1} · {option.label}
                </b>
                {option.key === decision.recommendation ? (
                  <span className="question-recommended">recommended</span>
                ) : null}
              </span>
              {option.description === "" ? null : (
                <span className="question-option-desc">
                  <Markdown text={option.description} inline links={false} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {decision.recommendationWhy === null ? null : (
        <p className="question-why">
          <b>Why{recommendedAt === -1 ? "" : ` ${recommendedAt + 1}`}:</b>{" "}
          <Markdown text={decision.recommendationWhy} inline />
        </p>
      )}
      {decision.recommendation !== null &&
      decision.options.every((option) => option.key !== decision.recommendation) ? (
        <p className="muted">Recommendation: {decision.recommendation}</p>
      ) : null}
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
        <form
          className="question-own"
          onSubmit={(event) => {
            event.preventDefault();
            form.sendOwn();
          }}
        >
          <TextBox
            label={`Your answer to ${decision.ref}`}
            placeholder="In your own words"
            value={form.ownWords}
            onChange={form.setOwn}
            onSubmit={form.sendOwn}
            autoFocus
          />
          <div className="question-actions">
            <button
              type="submit"
              className="btn"
              data-primary="true"
              disabled={form.ownWords.trim() === "" || form.sending}
            >
              {form.sending ? "Sending" : "Send"}
            </button>
            <button type="button" className="btn" onClick={form.closeOwn}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {form.error === null ? null : (
        <p className="error-text" role="alert">
          {form.error}
        </p>
      )}
    </article>
  );
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
