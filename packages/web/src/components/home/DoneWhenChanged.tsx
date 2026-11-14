import { Markdown } from "../ui/Markdown.tsx";

/** A done when an agent sharpened while the line waited: the old and the new with why, then Accept or Keep current. */
export function DoneWhenChanged({
  was,
  proposal,
  why,
  numbers,
  onAnswer,
}: {
  was: string;
  proposal: string;
  why: string | null;
  /** The numbers its two choices are drawn with, in the sheet's one run. */
  numbers: readonly [string, string];
  onAnswer(accept: boolean): void;
}) {
  return (
    <section className="start-sheet-part" aria-label="Done when changed">
      <span className="panel-label" data-tone="info">
        Done when changed
      </span>
      <p className="line-proposal-claim">
        "<Markdown text={was} inline />" became "<Markdown text={proposal} inline />
        ".
        {why === null ? null : (
          <>
            {" "}
            Why: <Markdown text={why} inline />
          </>
        )}
      </p>
      <div className="question-actions">
        <button type="button" className="btn" data-choice={numbers[0]} onClick={() => onAnswer(true)}>
          Accept
        </button>
        <button type="button" className="btn" data-choice={numbers[1]} onClick={() => onAnswer(false)}>
          Keep current
        </button>
      </div>
    </section>
  );
}
