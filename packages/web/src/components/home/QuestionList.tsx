import type { DecisionCard } from "@octotrack/core/schemas";
import { focusLabel } from "../../lib/focus.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { Fold } from "../ui/Fold.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";
import { ForYouRow } from "./ForYouRow.tsx";

/**
 * Questions that stand apart from the lines: urgent ones at the very top, and ones on no line below every line. Each
 * is a row until it has focus, so a key meant for another never answers it. On a phone the ones on no line fold to one
 * row, held open while one of them has focus; urgent ones never fold.
 */
export function QuestionList({
  title,
  cards,
  focus,
  inspecting,
  armed,
  onOpen,
  onPostponed,
  folded = false,
}: {
  title: string;
  folded?: boolean;
  cards: readonly DecisionCard[];
  focus: string | null;
  /** A panel is open over home: it takes the keys. */
  inspecting: boolean;
  armed: boolean;
  onOpen(ref: string): void;
  onPostponed(ref: string): void;
}) {
  if (cards.length === 0) return null;
  const rows = (
    <List>
      {cards.map((card) =>
        card.decision.ref === focus ? (
          <ForYouRow
            key={card.decision.ref}
            item={{ kind: "question", card }}
            label={focusLabel({ kind: "question", card })}
            focused
            onOpen={onOpen}
          >
            <DecisionCardItem card={card} active={!inspecting} armed={armed} onPostponed={onPostponed} />
          </ForYouRow>
        ) : (
          <ForYouRow
            key={card.decision.ref}
            item={{ kind: "question", card }}
            label={focusLabel({ kind: "question", card })}
            focused={false}
            onOpen={onOpen}
          />
        ),
      )}
    </List>
  );
  if (folded)
    return (
      <Fold title={title} count={cards.length} held={cards.some((card) => card.decision.ref === focus)}>
        {rows}
      </Fold>
    );
  return (
    <Section title={title} count={cards.length}>
      {rows}
    </Section>
  );
}
