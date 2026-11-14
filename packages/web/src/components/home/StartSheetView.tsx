import type { Decision, HeldItem, Line } from "@octotrack/core/schemas";
import { DoneWhenChanged } from "./DoneWhenChanged.tsx";
import { HeldQuestion } from "./HeldQuestion.tsx";

/** How many of what it holds, in words: "One question", "2 questions and a task". */
function heldWords(questions: number, tasks: number): string {
  const part = (count: number, one: string, many: string) =>
    count === 0 ? null : count === 1 ? one : `${count} ${many}`;
  const parts = [part(questions, "one question", "questions"), part(tasks, "one task", "tasks")].filter(
    (text) => text !== null,
  );
  const words = parts.join(" and ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The sentence at the top: what has waited for the line, and that settling it now starts the line with it. */
function intro(line: Line, held: readonly HeldItem[]): string {
  const questions = held.filter((item) => item.kind === "question").length;
  const tasks = held.length - questions;
  const changed = line.doneWhenProposal !== null;
  if (held.length === 0 && !changed) return "Nothing has been waiting for this line: it starts clean.";
  const waited =
    held.length === 0
      ? "Its done when was sharpened while it waited."
      : `${heldWords(questions, tasks)} ${held.length === 1 ? "has" : "have"} been waiting for this line${changed ? ", and its done when was sharpened" : ""}.`;
  return `${waited} Settle ${held.length + (changed ? 1 : 0) === 1 ? "it" : "them"} now and the line starts with ${held.length + (changed ? 1 : 0) === 1 ? "it" : "them"}.`;
}

/**
 * Starting a line that waited, as E-States draws it: what it holds that is still current (asked or re-confirmed in the
 * last 7 days), a done when an agent sharpened while it waited, each with its choices numbered in one run, then Start.
 * Held questions are answered here, with the usual Undo; tasks reach the developer once the line starts.
 */
export function StartSheetView({
  line,
  held,
  questions,
  onDoneWhen,
  onAnswer,
  onStart,
  onCancel,
}: {
  line: Line;
  held: readonly HeldItem[];
  /** The held questions themselves, to answer here. */
  questions: readonly Decision[];
  onDoneWhen(accept: boolean): void;
  onAnswer(ref: string, key: string, label: string): void;
  onStart(): void;
  onCancel(): void;
}) {
  let number = 0;
  const next = () => {
    number += 1;
    return String(number);
  };
  const tasks = held.filter((item) => item.kind === "task");
  const asked = held.flatMap((item) => {
    const question = questions.find((candidate) => candidate.ref === item.ref);
    return item.kind === "question" && question !== undefined ? [question] : [];
  });
  return (
    <dialog
      open
      className="start-sheet"
      aria-labelledby={`start-${line.ref}`}
      tabIndex={-1}
      // biome-ignore lint/a11y/noAutofocus: the developer opened it to act on it, so the keys and Tab start here
      autoFocus
      onKeyDown={(event) => {
        // Esc closes the sheet first, before anything behind it.
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <h2 className="start-sheet-title" id={`start-${line.ref}`}>
        Start {line.title}
      </h2>
      <p className="muted">{intro(line, held)}</p>
      {line.doneWhenProposal === null ? null : (
        <DoneWhenChanged
          was={line.doneWhen}
          proposal={line.doneWhenProposal}
          why={line.doneWhenWhy}
          numbers={[next(), next()]}
          onAnswer={onDoneWhen}
        />
      )}
      {asked.map((question) => (
        <HeldQuestion
          key={question.ref}
          question={question}
          numbers={question.options.map(() => next())}
          onAnswer={onAnswer}
        />
      ))}
      {tasks.length === 0 ? null : (
        <section className="start-sheet-part" aria-label="Tasks it holds">
          <span className="panel-label">Tasks, which reach you once it starts</span>
          <ul className="start-sheet-list">
            {tasks.map((item) => (
              <li key={item.ref}>
                <span className="mono muted">{item.ref}</span> {item.title}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted">
        It joins the bottom of Working on, and the owner search runs at once: its last owner if it had one, an
        idle agent with the repo that is running, told in its next reply, else a new session.
      </p>
      <div className="question-actions">
        <button type="button" className="btn" data-primary="true" onClick={onStart}>
          Start
        </button>
        <button type="button" className="btn" data-quiet="true" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
