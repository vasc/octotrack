import type { DecisionCard } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { useDecisionForm } from "../../hooks/useDecisionForm.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { DecisionCardView } from "./DecisionCardView.tsx";

const NO_KEYS = {};

/**
 * One question with its form state. The active one answers to the number keys, one per option, and p for Later,
 * unless disarmed while its answer waits with Undo.
 */
export function DecisionCardItem({
  card,
  active = false,
  armed = active,
  onPostponed,
}: {
  card: DecisionCard;
  active?: boolean;
  armed?: boolean;
  onPostponed?: (ref: string) => void;
}) {
  const form = useDecisionForm(card.decision, onPostponed);
  const { answer, postpone, ownWords } = form;
  const keys = useMemo(() => {
    if (!active || !armed || ownWords !== null) return NO_KEYS;
    const numbered = card.decision.options.map((option, index) => [
      String(index + 1),
      () => answer(option.key),
    ]);
    return { ...Object.fromEntries(numbered), p: postpone };
  }, [active, armed, ownWords, card.decision.options, answer, postpone]);
  useHotkeys(keys);
  return <DecisionCardView card={card} form={form} selected={active} />;
}
