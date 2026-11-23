import type { DecisionCard } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { useDecisionForm } from "../../hooks/useDecisionForm.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLinePlace } from "../../hooks/useLinePlace.ts";
import { useClock } from "../../hooks/useClock.ts";
import { DecisionCardView } from "./DecisionCardView.tsx";

const NO_KEYS = {};

/**
 * One question with its form state. The active one answers to the number keys, one per option, w for an answer in
 * the developer's own words and l for Later, unless disarmed while its answer waits with Undo.
 */
export function DecisionCardItem({
  card,
  active = false,
  armed = active,
  onPostponed,
  onAnswered,
  titled = true,
  placed = true,
}: {
  card: DecisionCard;
  /** Its title is drawn; not where a panel's head already carries it. */
  titled?: boolean;
  active?: boolean;
  armed?: boolean;
  onPostponed?: (ref: string) => void;
  /** Answered: the page may move on while the answer waits with Undo. */
  onAnswered?: (ref: string) => void;
  /** An urgent one names its line, which stands apart from it; not where the line is named just above it. */
  placed?: boolean;
}) {
  const form = useDecisionForm(card.decision, onPostponed, onAnswered);
  const { answer, postpone, ownWords, openOwn } = form;
  const keys = useMemo(() => {
    if (!active || !armed || ownWords !== null || form.waiting !== null) return NO_KEYS;
    const numbered = card.decision.options.map((option, index) => [
      String(index + 1),
      () => answer(option.key),
    ]);
    return { ...Object.fromEntries(numbered), w: openOwn, l: postpone };
  }, [active, armed, ownWords, form.waiting, card.decision.options, answer, postpone, openOwn]);
  useHotkeys(keys);
  const place = useLinePlace(card.decision.line);
  const line = placed ? place : null;
  const now = useClock(form.waiting !== null);
  return <DecisionCardView card={card} form={form} line={line} now={now} titled={titled} />;
}
