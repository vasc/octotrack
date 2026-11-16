import type { Decision } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Options } from "../ui/Options.tsx";

/**
 * A question's answers, each saying what happens, the recommended one marked with its reason inside it. One press
 * answers.
 */
export function QuestionOptions({
  decision,
  onAnswer,
  chosen,
}: {
  decision: Decision;
  onAnswer(key: string): void;
  /** The answer picked, while it waits with Undo. */
  chosen?: string | undefined;
}) {
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
            ...(option.key === decision.recommendation && decision.recommendationWhy !== null
              ? { why: <Markdown text={decision.recommendationWhy} inline /> }
              : {}),
          }))}
          onPick={onAnswer}
          chosen={chosen}
        />
      )}
      {decision.recommendationWhy !== null && recommendedAt === -1 ? (
        <Note>
          Why: <Markdown text={decision.recommendationWhy} inline />
        </Note>
      ) : null}
      {decision.recommendation !== null && recommendedAt === -1 ? (
        <Note>Recommendation: {decision.recommendation}</Note>
      ) : null}
    </>
  );
}
