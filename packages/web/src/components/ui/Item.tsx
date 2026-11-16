import type { ReactNode } from "react";
import type { Tone } from "./Row.tsx";

/**
 * Something opened in place, such as a question or a task, in three zones always in this order: what it is (its kind
 * and facts on one small line, its title, what it holds), what you do (under a hairline, headed by its label), then
 * other ways out. It has no box; the row it opens in is its sheet.
 */
export function Item({
  kind,
  tone = "needs",
  title,
  label,
  answer,
  answerLabel,
  ways,
  children,
}: {
  kind: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  /** Names it for a screen reader. */
  label?: string;
  /** What you do: the answers, the outcome to fill in. Drawn under a hairline that separates reading from deciding. */
  answer?: ReactNode;
  /** What heads the answer, such as "Your answer". */
  answerLabel?: ReactNode;
  /** Other ways out, such as In my own words and Later. */
  ways?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="ui-item" aria-label={label}>
      <div className="ui-item-read">
        <span className="ui-row-kind">
          <KindText kind={kind} tone={tone} />
        </span>
        {title === undefined ? null : <h3 className="ui-item-title">{title}</h3>}
        {children}
      </div>
      {answer === undefined ? null : (
        <div className="ui-item-answer">
          {answerLabel === undefined ? null : <div className="ui-item-answer-label">{answerLabel}</div>}
          {answer}
        </div>
      )}
      {ways === undefined ? null : <div className="ui-item-ways">{ways}</div>}
    </article>
  );
}

/** The word that says what an item is, such as Question or Urgent, in its tone: the one coloured word on its line. */
export function Kind({ tone = "needs", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="ui-kind" data-tone={tone}>
      {children}
    </span>
  );
}

/**
 * What an item is, on its small line: given as words ("Task for you · PANEL-1 · at the bench"), its first part is the
 * kind word in its tone and the rest are grey facts; given as anything else, it is drawn as given.
 */
export function KindText({ kind, tone = "needs" }: { kind: ReactNode; tone?: Tone }) {
  if (typeof kind !== "string") return <>{kind}</>;
  const at = kind.indexOf(" · ");
  const word = at === -1 ? kind : kind.slice(0, at);
  return (
    <>
      <Kind tone={tone}>{word}</Kind>
      {at === -1 ? null : kind.slice(at)}
    </>
  );
}
