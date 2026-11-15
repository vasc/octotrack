import type { Issue } from "@octotrack/core/schemas";
import { useState } from "react";
import { filledCount, type TaskOutcome, taskOutcome } from "../../lib/tasks.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { TextBox } from "../ui/TextBox.tsx";
import { OutcomeFields } from "./OutcomeFields.tsx";

export interface TaskCardProps {
  task: Issue;
  /** What is typed so far, kept as a draft by the caller: the outcome, or the note beside named outcomes. */
  words: string;
  onWords(words: string): void;
  /** Each named outcome typed so far, kept in the same draft. */
  values: Readonly<Record<string, string>>;
  onValue(name: string, value: string): void;
  /** Why it cannot be done, kept apart from what was found, so neither is sent as the other. */
  why: string;
  onWhy(why: string): void;
  onDone(outcome: TaskOutcome): void;
  onCant(why: string): void;
  /** Its Done or Can't do it is waiting with Undo: neither is sent again. */
  sending?: boolean;
  /** The plan step it holds up, by title, where that is known. */
  holdsUp?: string;
}

/**
 * A task opened: where, what it is, and what to send back, as a form saved as it is typed: one box, or a box for each
 * named outcome and a note, with how many are filled. 1 · Done sends it; 2 · Can't do it asks why and closes it as not
 * done. A task of the developer's own has nothing to send back: Done is enough.
 */
export function TaskCard({
  task,
  words,
  onWords,
  values,
  onValue,
  why,
  onWhy,
  onDone,
  onCant,
  sending = false,
  holdsUp,
}: TaskCardProps) {
  const [cant, setCant] = useState(false);
  const own = task.outcome === "";
  const named = task.fields.length > 0;
  const outcome = taskOutcome(task, values, words);
  const ready = outcome !== null && !sending;
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task for you · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
        {holdsUp === undefined ? "" : ` · holds up ${holdsUp}`}
        {task.createdBy === "dev" ? "" : ` · filed by ${task.createdBy}`}
      </p>
      <h3 className="question-title">{task.title}</h3>
      {task.body === "" ? null : <Markdown text={task.body} />}
      <form
        className="task-form"
        aria-label={cant ? "Say why it cannot be done" : "Report the outcome"}
        onSubmit={(event) => {
          event.preventDefault();
          if (cant) {
            if (why.trim() !== "" && !sending) onCant(why.trim());
            return;
          }
          // The words stay a draft until the task closes, which deletes it: an Undo must not lose them.
          if (outcome !== null && !sending) onDone(outcome);
        }}
      >
        {own && !cant ? null : (
          <>
            <span className="panel-label" data-tone="attention">
              {cant ? "Why it cannot be done" : "What to send back"}
            </span>
            {task.outcome === null || own || cant ? null : (
              <span className="task-outcome">
                <Markdown text={task.outcome} inline />
              </span>
            )}
            {named && !cant ? (
              <OutcomeFields
                fields={task.fields}
                values={values}
                onValue={onValue}
                note={words}
                onNote={onWords}
              />
            ) : (
              <TextBox
                label={cant ? `Why ${task.ref} cannot be done` : `What ${task.ref} found`}
                placeholder={cant ? "Why not" : (task.outcome ?? "What you found")}
                value={cant ? why : words}
                onChange={cant ? onWhy : onWords}
              />
            )}
          </>
        )}
        <div className="question-actions">
          {cant ? (
            <>
              <button
                type="submit"
                className="btn"
                data-primary="true"
                disabled={why.trim() === "" || sending}
              >
                Close it
              </button>
              <button type="button" className="btn" onClick={() => setCant(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="submit" className="btn" data-tone="attention" data-choice="1" disabled={!ready}>
                Done
              </button>
              <button type="button" className="btn" data-choice="2" onClick={() => setCant(true)}>
                Can't do it
              </button>
            </>
          )}
        </div>
        {own || cant ? null : (
          <span className="muted">
            {named ? `${filledCount(task, values)} of ${task.fields.length} filled, saved` : "Saved"} as you
            type, so you can finish on another day or device. Done sends {named ? "them all" : "it"}; Can't do
            it asks why and closes the task as not done.
          </span>
        )}
      </form>
    </article>
  );
}
