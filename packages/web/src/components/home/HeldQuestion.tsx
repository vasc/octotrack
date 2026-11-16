import type { Decision } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Options } from "../ui/Options.tsx";

/**
 * A question held while the line waited, answered in the Start sheet, its answers numbered in the sheet's one run. A
 * question with no options has its own-words box open, as everywhere a question has none.
 */
export function HeldQuestion({
  question,
  firstChoice,
  onAnswer,
  onOwn,
}: {
  question: Decision;
  /** The number its first answer is drawn with. */
  firstChoice: number;
  onAnswer(ref: string, key: string, label: string): void;
  /** An answer in the developer's own words. */
  onOwn(ref: string, words: string): void;
}) {
  // What is typed is answered from this sheet alone, so it is the component's own state.
  const [words, setWords] = useState("");
  return (
    <Item label={question.title} kind={`Question · ${question.ref}`} title={question.title}>
      {question.context === "" ? null : <Markdown text={question.context} />}
      {question.options.length === 0 ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (words.trim() !== "") onOwn(question.ref, words.trim());
          }}
        >
          <Field label="Your answer" value={words} onChange={setWords} multiline />
          <Actions>
            <Button type="submit" variant="primary" disabled={words.trim() === ""}>
              Send
            </Button>
          </Actions>
        </form>
      ) : (
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
      )}
    </Item>
  );
}
