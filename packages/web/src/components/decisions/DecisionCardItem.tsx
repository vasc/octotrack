import type { DecisionCard } from "@octotrack/core/schemas";
import { useMemo } from "react";
import { useDecisionForm } from "../../hooks/useDecisionForm.ts";
import { useHotkeys } from "../../hooks/useHotkeys.ts";
import { useLinePlace } from "../../hooks/useLinePlace.ts";
import { openEntity } from "../../lib/router.ts";
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
  background = false,
}: {
  card: DecisionCard;
  active?: boolean;
  armed?: boolean;
  onPostponed?: (ref: string) => void;
  /** Offer Background: the question opened on its own, with its history and connections. */
  background?: boolean;
}) {
  const form = useDecisionForm(card.decision, onPostponed);
  const { answer, postpone, ownWords, openOwn } = form;
  const keys = useMemo(() => {
    if (!active || !armed || ownWords !== null) return NO_KEYS;
    const numbered = card.decision.options.map((option, index) => [
      String(index + 1),
      () => answer(option.key),
    ]);
    return { ...Object.fromEntries(numbered), w: openOwn, l: postpone };
  }, [active, armed, ownWords, card.decision.options, answer, postpone, openOwn]);
  useHotkeys(keys);
  const line = useLinePlace(card.decision.line);
  return (
    <DecisionCardView
      card={card}
      form={form}
      line={line}
      {...(background ? { onBackground: () => openEntity(card.decision.ref) } : {})}
    />
  );
}
