import { focusLabel } from "../../lib/focus.ts";
import type { DecisionCard } from "@octotrack/core/schemas";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { FocusTarget } from "./FocusTarget.tsx";
import { ForYouRow } from "./ForYouRow.tsx";
import { HomeSection } from "./HomeSection.tsx";

/**
 * Questions that stand apart from the lines: urgent ones at the very top, and ones from before lines below every line.
 * Each is a row until it has focus, like any question, so a key meant for another never answers it.
 */
export function QuestionList({
  title,
  note,
  cards,
  focus,
  inspecting,
  armed,
  onOpen,
  onPostponed,
}: {
  title: string;
  note?: string;
  cards: readonly DecisionCard[];
  focus: string | null;
  /** A panel is open over home: it takes the keys. */
  inspecting: boolean;
  armed: boolean;
  onOpen(ref: string): void;
  onPostponed(ref: string): void;
}) {
  if (cards.length === 0) return null;
  return (
    <HomeSection title={title} count={cards.length} {...(note === undefined ? {} : { note })}>
      <div className="line-items" data-flush="true">
        {cards.map((card) => (
          <FocusTarget
            key={card.decision.ref}
            focusRef={card.decision.ref}
            label={focusLabel({ kind: "question", card })}
            focused={card.decision.ref === focus}
          >
            {card.decision.ref === focus ? (
              <DecisionCardItem card={card} active={!inspecting} armed={armed} onPostponed={onPostponed} />
            ) : (
              <ForYouRow item={{ kind: "question", card }} onOpen={onOpen} />
            )}
          </FocusTarget>
        ))}
      </div>
    </HomeSection>
  );
}
