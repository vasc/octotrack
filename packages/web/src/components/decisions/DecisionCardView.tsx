import type { DecisionCard } from "@octotrack/core/schemas";
import { useRef } from "react";
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
  // Tapping "Something else" has to open the keyboard, which only a real focus call inside the tap can do.
  const noteField = useRef<HTMLInputElement>(null);
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  return (
    <article className="decision" data-selected={selected} aria-label={decision.title}>
      <DecisionMeta decision={decision} />
      <h3 className="decision-title">{decision.title}</h3>
      {card.reasons.length === 0 && decision.postponedAt === null ? null : (
        <div className="decision-reasons">
          {decision.postponedAt === null ? null : <Badge>postponed</Badge>}
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
        ownAnswer={form.ownAnswer}
        onChoose={form.choose}
        onChooseOwn={() => {
          form.chooseOwn();
          noteField.current?.focus();
        }}
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
          ref={noteField}
          className="field"
          aria-label={`Note for ${decision.ref}`}
          placeholder={form.ownAnswer || decision.options.length === 0 ? "Your answer" : "Why (optional)"}
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
        <button type="button" className="btn" onClick={form.postpone}>
          {decision.postponedAt === null ? "Postpone" : "Bring back"}
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
