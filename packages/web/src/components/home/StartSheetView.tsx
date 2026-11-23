import type { Decision, HeldItem, Line } from "@octotrack/core/schemas";
import type { ReactNode, Ref } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Sheet } from "../ui/Sheet.tsx";
import { EmptyState } from "../ui/states.tsx";
import { DoneWhenChanged } from "./DoneWhenChanged.tsx";
import { HeldQuestion } from "./HeldQuestion.tsx";

/**
 * Starting a line that waited, in a sheet of its own: what it holds that is still current, and a done when an agent
 * sharpened while it waited, each with its choices numbered in one run, then Start. Held questions are answered here,
 * with the usual Undo; its tasks reach the developer once the line starts.
 */
export function StartSheetView({
  line,
  held,
  questions,
  onDoneWhen,
  onAnswer,
  onOwn,
  onStart,
  onCancel,
  sheetRef,
  status,
}: {
  line: Line;
  held: readonly HeldItem[];
  /** The held questions themselves, to answer here. */
  questions: readonly Decision[];
  onDoneWhen(accept: boolean): void;
  onAnswer(ref: string, key: string, label: string): void;
  /** A held question with no options, answered in the developer's own words. */
  onOwn(ref: string, words: string): void;
  onStart(): void;
  onCancel(): void;
  /** The sheet, where the number keys find its choices. */
  sheetRef?: Ref<HTMLDivElement>;
  /** What the sheet says in place of what the line holds, while that loads or if it failed to. */
  status?: ReactNode;
}) {
  const tasks = held.filter((item) => item.kind === "task");
  const heldQuestions = held.filter((item) => item.kind === "question");
  // Held questions no longer open to answer here, such as one answered elsewhere meanwhile, still show by title.
  const gone = heldQuestions.filter((item) => !questions.some((question) => question.ref === item.ref));
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const asked = held.flatMap((item) => {
    const question = questions.find((candidate) => candidate.ref === item.ref);
    return item.kind === "question" && question !== undefined ? [question] : [];
  });
  // What still waits: questions answered elsewhere meanwhile no longer count.
  const waited = [
    asked.length === 0 ? null : count(asked.length, "question"),
    tasks.length === 0 ? null : count(tasks.length, "task"),
  ].filter((part) => part !== null);
  const answerable =
    asked.length === 0
      ? ""
      : asked.length === 1
        ? " Answer it now, or start and it reaches you on the line."
        : " Answer them now, or start and they reach you on the line.";
  // One run of numbers across the sheet: the done when's two choices, then each question's answers.
  let next = line.doneWhenProposal === null ? 1 : 3;
  const firsts = asked.map((question) => {
    const first = next;
    next += question.options.length;
    return first;
  });
  return (
    <Sheet
      title={`Start ${line.title}`}
      onClose={onCancel}
      {...(sheetRef === undefined ? {} : { ref: sheetRef })}
      actions={
        <Actions>
          <Button variant="primary" onClick={onStart}>
            Start
          </Button>
        </Actions>
      }
    >
      {waited.length === 0 ? null : (
        <Note>
          {waited.join(" and ")} waited for it.{answerable}
        </Note>
      )}
      {status !== undefined ? status : null}
      {status !== undefined ? null : line.doneWhenProposal === null && waited.length === 0 ? (
        <EmptyState>Nothing waited for it</EmptyState>
      ) : null}
      {line.doneWhenProposal === null ? null : (
        <DoneWhenChanged
          was={line.doneWhen}
          proposal={line.doneWhenProposal}
          why={line.doneWhenWhy}
          by={line.doneWhenProposedBy}
          numbers={["1", "2"]}
          onAnswer={onDoneWhen}
        />
      )}
      {asked.map((question, index) => (
        <HeldQuestion
          key={question.ref}
          question={question}
          firstChoice={firsts[index] ?? 1}
          onAnswer={onAnswer}
          onOwn={onOwn}
        />
      ))}
      {status !== undefined || gone.length === 0 ? null : (
        <List label="Answered meanwhile">
          {gone.map((item) => (
            <Row key={item.ref} kind={<RefLink value={item.ref} />} title={item.title} />
          ))}
        </List>
      )}
      {tasks.length === 0 ? null : (
        <List label="Tasks, once it starts">
          {tasks.map((item) => (
            <Row key={item.ref} kind={<RefLink value={item.ref} />} title={item.title} />
          ))}
        </List>
      )}
    </Sheet>
  );
}
