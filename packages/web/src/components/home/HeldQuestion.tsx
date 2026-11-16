import type { Decision } from "@octotrack/core/schemas";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Options } from "../ui/Options.tsx";

/** A question held while the line waited, answered in the Start sheet, its answers numbered in the sheet's one run. */
export function HeldQuestion({
  question,
  firstChoice,
  onAnswer,
}: {
  question: Decision;
  /** The number its first answer is drawn with. */
  firstChoice: number;
  onAnswer(ref: string, key: string, label: string): void;
}) {
  return (
    <Item label={question.title} kind={`Question · ${question.ref}`} title={question.title}>
      {question.context === "" ? null : <Markdown text={question.context} />}
      <Options
        firstChoice={firstChoice}
        options={question.options.map((option) => ({
          key: option.key,
          label: option.label,
          recommended: option.key === question.recommendation,
          ...(option.key === question.recommendation && question.recommendationWhy !== null
            ? { why: <Markdown text={question.recommendationWhy} inline /> }
            : {}),
        }))}
        onPick={(key) =>
          onAnswer(question.ref, key, question.options.find((option) => option.key === key)?.label ?? key)
        }
      />
    </Item>
  );
}
