import type { DecisionCard } from "@octotrack/core/schemas";
import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import { Badge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { DecisionMeta } from "./DecisionMeta.tsx";
import { DecisionOptions } from "./DecisionOptions.tsx";

export interface DecisionCardViewProps {
  card: DecisionCard;
  form: DecisionForm;
  selected?: boolean;
}

/** Everything needed to make the call, without leaving the feed. Pure: all state comes in through `form`. */
export function DecisionCardView({ card, form, selected = false }: DecisionCardViewProps) {
  const { decision } = card;
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  return (
    <article className="decision" data-selected={selected} aria-label={decision.title}>
      <DecisionMeta decision={decision} />
      <h3 className="decision-title">{decision.title}</h3>
      {card.reasons.length === 0 ? null : (
        <div className="decision-reasons">
          {card.reasons.map((reason) => (
            <Badge key={reason} tone="attention">
              {reason}
            </Badge>
          ))}
        </div>
      )}
      {decision.context === "" ? null : <p className="decision-context">{decision.context}</p>}
      <DecisionOptions
        options={decision.options}
        recommendation={decision.recommendation}
        chosen={form.chosen}
        onChoose={form.choose}
      />
      {decision.recommendation !== null &&
      decision.options.every((option) => option.key !== decision.recommendation) ? (
        <p className="muted">Recommendation: {decision.recommendation}</p>
      ) : null}
      {openWork.length === 0 ? null : (
        <div className="decision-top">
          <span>Blocks</span>
          {openWork.map((item) => (
            <RefLink key={item.ref} value={item.ref} />
          ))}
        </div>
      )}
      <form
        className="decision-actions"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <input
          className="field"
          aria-label={`Note for ${decision.ref}`}
          placeholder={
            decision.options.length === 0 ? "Your answer" : "Why, or an answer none of these cover"
          }
          value={form.note}
          onChange={(event) => form.setNote(event.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={form.elsewhere}
            onChange={(event) => form.setElsewhere(event.target.checked)}
          />
          decided elsewhere
        </label>
        <button
          type="submit"
          className="btn"
          data-primary="true"
          disabled={!form.canSubmit || form.submitting}
        >
          Decide
        </button>
      </form>
      {form.error === null ? null : (
        <p className="error-text" role="alert">
          {form.error}
        </p>
      )}
    </article>
  );
}
