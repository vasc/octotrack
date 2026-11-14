import type { Decision } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";

/** A question held while the line waited, answered in the Start sheet: its options numbered in the sheet's one run. */
export function HeldQuestion({
  question,
  numbers,
  onAnswer,
}: {
  question: Decision;
  /** The number each option is drawn with. */
  numbers: readonly string[];
  onAnswer(ref: string, key: string, label: string): void;
}) {
  const recommended = question.options.findIndex((option) => option.key === question.recommendation);
  return (
    <section className="start-sheet-part" aria-label={question.title}>
      <span className="panel-label" data-tone="attention">
        Question · {question.ref}
      </span>
      <h3 className="question-title">{question.title}</h3>
      {question.context === "" ? null : (
        <div className="question-context">
          <Markdown text={question.context} />
        </div>
      )}
      <div className="question-actions">
        {question.options.map((option, index) => (
          <button
            key={option.key}
            type="button"
            className="btn"
            aria-label={option.label}
            data-choice={numbers[index]}
            data-primary={index === recommended}
            onClick={() => onAnswer(question.ref, option.key, option.label)}
          >
            {option.label}
            {index === recommended ? " · recommended" : ""}
          </button>
        ))}
      </div>
      {question.recommendationWhy === null || recommended === -1 ? null : (
        <p className="question-why">
          <b>Why {numbers[recommended]}:</b> <Markdown text={question.recommendationWhy} inline />
        </p>
      )}
    </section>
  );
}
