import type { DecisionCard } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { useDecisionForm } from "../../hooks/useDecisionForm.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { DecisionCardView } from "./DecisionCardView.tsx";

const NO_KEYS = {};

/** One card with its form state. The first card in the queue listens for number keys and Enter. */
export function DecisionCardItem({ card, active = false }: { card: DecisionCard; active?: boolean }) {
  const form = useDecisionForm(card.decision);
  const { choose, submit } = form;
  const keys = useMemo(() => {
    if (!active) return NO_KEYS;
    const numbered = card.decision.options.map((option, index) => [
      String(index + 1),
      () => choose(option.key),
    ]);
    return { ...Object.fromEntries(numbered), Enter: submit };
  }, [active, card.decision.options, choose, submit]);
  useHotkeys(keys);
  return <DecisionCardView card={card} form={form} selected={active} />;
}
