import type { DecisionCard } from "@octotrack/core/schemas";
import type { DecisionForm } from "../../hooks/useDecisionForm.ts";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { NotKept } from "../ui/NotKept.tsx";
import { Note } from "../ui/Note.tsx";
import { Waiting } from "../ui/Waiting.tsx";
import { OwnWords } from "./OwnWords.tsx";
import { QuestionOptions } from "./QuestionOptions.tsx";
import { QuestionStrip } from "./QuestionStrip.tsx";

export interface DecisionCardViewProps {
  card: DecisionCard;
  form: DecisionForm;
  /** Its line's place in the order: an urgent question stands apart from its line, so it names it. */
  line?: LinePlace | null;
  /** The time now, in milliseconds, for an answer's countdown and the question's age. */
  now?: number;
  /** Its title is drawn; not where a panel's head already carries it. */
  titled?: boolean;
}

/**
 * A question opened, in three zones: what is asked (the strip, the question, its situation); your answer (the options,
 * the recommended one with its reason inside it, under a hairline); then the other ways out. An answer waits in the
 * card with Undo. Pure: all state comes in through `form`.
 */
export function DecisionCardView({
  card,
  form,
  line = null,
  now = Date.now(),
  titled = true,
}: DecisionCardViewProps) {
  const { decision } = card;
  const noOptions = decision.options.length === 0;
  const waiting = form.waiting;
  const answerLabel =
    decision.recommendation === null && !noOptions
      ? `Your answer · ${decision.requestedBy} makes no recommendation`
      : "Your answer";
  const ways =
    waiting !== null ? (
      <Waiting
        what={waiting.chosen === null ? `Sending your words to ${waiting.to}` : `Sending to ${waiting.to}`}
        dueAt={waiting.dueAt}
        now={now}
        onUndo={waiting.undo}
        undoLabel={`Undo the answer to ${decision.ref}`}
      />
    ) : form.ownWords !== null || noOptions ? undefined : (
      <Actions>
        <Button onClick={form.openOwn}>In my own words</Button>
        <Button onClick={form.postpone}>{decision.postponedAt === null ? "Later" : "Bring back"}</Button>
        {decision.urgentReason === null || decision.notUrgentAt !== null ? null : (
          <Button onClick={form.notUrgent}>Not urgent</Button>
        )}
      </Actions>
    );
  return (
    <Item
      label={decision.title}
      kind={<QuestionStrip card={card} line={line} now={now} />}
      tone={decision.urgentReason === null ? "needs" : "stuck"}
      {...(titled ? { title: decision.title } : {})}
      answer={
        <>
          {form.ownWords !== null || (noOptions && waiting === null) ? (
            <OwnWords form={form} open={noOptions} />
          ) : (
            <QuestionOptions
              decision={decision}
              onAnswer={form.answer}
              chosen={waiting?.chosen ?? undefined}
            />
          )}
          <NotKept unsaved={form.notSaved} />
        </>
      }
      {...(form.ownWords !== null || noOptions ? {} : { answerLabel })}
      {...(ways === undefined ? {} : { ways })}
    >
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      {noOptions && decision.recommendation !== null ? (
        <Note>Recommendation: {decision.recommendation}</Note>
      ) : null}
    </Item>
  );
}
