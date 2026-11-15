import type { Decision } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Options } from "../ui/Options.tsx";

/**
 * A question's answers, each saying what happens, the recommended one marked, and the reason for it directly under
 * them. One press answers.
 */
export function QuestionOptions({ decision, onAnswer }: { decision: Decision; onAnswer(key: string): void }) {
  const recommendedAt = decision.options.findIndex((option) => option.key === decision.recommendation);
  return (
    <>
      {decision.options.length === 0 ? null : (
        <Options
          options={decision.options.map((option) => ({
            key: option.key,
            label: option.label,
            recommended: option.key === decision.recommendation,
            ...(option.description === ""
              ? {}
              : { description: <Markdown text={option.description} inline links={false} /> }),
          }))}
          onPick={onAnswer}
        />
      )}
      {decision.recommendationWhy === null ? null : (
        <Note>
          Why{recommendedAt === -1 ? "" : ` ${recommendedAt + 1}`}:{" "}
          <Markdown text={decision.recommendationWhy} inline />
        </Note>
      )}
      {decision.recommendation !== null && recommendedAt === -1 ? (
        <Note>Recommendation: {decision.recommendation}</Note>
      ) : null}
    </>
  );
}
