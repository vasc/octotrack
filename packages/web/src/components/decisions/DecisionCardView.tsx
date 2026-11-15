import type { DecisionCard } from "@octotrack/core/schemas";
import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { OwnWords } from "./OwnWords.tsx";
import { QuestionOptions } from "./QuestionOptions.tsx";
import { QuestionStrip } from "./QuestionStrip.tsx";

export interface DecisionCardViewProps {
  card: DecisionCard;
  form: DecisionForm;
  /** Its line's place in the order: an urgent question stands apart from its line, so it names it. */
  line?: LinePlace | null;
  /** In a line's panel: open the question on its own, with what led to it and what it connects to. */
  onBackground?: () => void;
}

/**
 * A question opened: the situation, options that say what happens, the reason for the recommendation directly under
 * them, and the answer in one press. Pure: all state comes in through `form`.
 */
export function DecisionCardView({ card, form, line = null, onBackground }: DecisionCardViewProps) {
  const { decision } = card;
  return (
    <Item
      label={decision.title}
      kind={<QuestionStrip card={card} line={line} />}
      tone={decision.urgentReason === null ? "needs" : "stuck"}
      title={decision.title}
    >
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      <QuestionOptions decision={decision} onAnswer={form.answer} />
      {form.ownWords === null ? (
        <Actions>
          <Button onClick={form.openOwn}>In my own words</Button>
          <Button onClick={form.postpone}>{decision.postponedAt === null ? "Later" : "Bring back"}</Button>
          {onBackground === undefined ? null : <Button onClick={onBackground}>Background</Button>}
          {decision.urgentReason === null || decision.notUrgentAt !== null ? null : (
            <Button onClick={form.notUrgent}>Not urgent</Button>
          )}
        </Actions>
      ) : (
        <OwnWords refName={decision.ref} form={form} />
      )}
      {form.error === null ? null : <Note error>{form.error}</Note>}
    </Item>
  );
}
