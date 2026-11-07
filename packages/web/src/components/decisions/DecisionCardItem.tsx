import type { DecisionCard } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { useDecisionForm } from "../../hooks/useDecisionForm.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { DecisionCardView } from "./DecisionCardView.tsx";

const NO_KEYS = {};

/** One card with its form state. The first card in the queue listens for number keys and Enter. */
export function DecisionCardItem({
  card,
  active = false,
  onPostponed,
}: {
  card: DecisionCard;
  active?: boolean;
  onPostponed?: (ref: string) => void;
}) {
  const form = useDecisionForm(card.decision, onPostponed);
  const { choose, chooseOwn, postpone, submit } = form;
  const keys = useMemo(() => {
    if (!active) return NO_KEYS;
    const numbered = card.decision.options.map((option, index) => [
      String(index + 1),
      () => choose(option.key),
    ]);
    const own = numbered.length === 0 ? [] : [[String(numbered.length + 1), chooseOwn]];
    return { ...Object.fromEntries([...numbered, ...own]), Enter: submit, p: postpone };
  }, [active, card.decision.options, choose, chooseOwn, postpone, submit]);
  useHotkeys(keys);
  return <DecisionCardView card={card} form={form} selected={active} />;
}
