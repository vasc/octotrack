import type { Decision } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";

/**
 * A question's options side by side, each saying what happens, numbered for the keys, the recommended one marked; and
 * the reason for the recommendation directly under them. One press answers.
 */
export function QuestionOptions({ decision, onAnswer }: { decision: Decision; onAnswer(key: string): void }) {
  const recommendedAt = decision.options.findIndex((option) => option.key === decision.recommendation);
  const columns = Math.min(Math.max(decision.options.length, 1), 3);
  return (
    <>
      {decision.options.length === 0 ? null : (
        <div className="question-options" data-columns={columns}>
          {decision.options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              className="question-option"
              data-recommended={option.key === decision.recommendation}
              onClick={() => onAnswer(option.key)}
            >
              <span className="question-option-head">
                <b>
                  {index + 1} · {option.label}
                </b>
                {option.key === decision.recommendation ? (
                  <span className="question-recommended">recommended</span>
                ) : null}
              </span>
              {option.description === "" ? null : (
                <span className="question-option-desc">
                  <Markdown text={option.description} inline links={false} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {decision.recommendationWhy === null ? null : (
        <p className="question-why">
          <b>Why{recommendedAt === -1 ? "" : ` ${recommendedAt + 1}`}:</b>{" "}
          <Markdown text={decision.recommendationWhy} inline />
        </p>
      )}
      {decision.recommendation !== null && recommendedAt === -1 ? (
        <p className="muted">Recommendation: {decision.recommendation}</p>
      ) : null}
    </>
  );
}
