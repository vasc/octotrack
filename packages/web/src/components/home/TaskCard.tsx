import type { Issue } from "@octotrack/core/schemas";
import { useState } from "react";
import { Markdown } from "../ui/Markdown.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface TaskCardProps {
  task: Issue;
  /** What is typed so far, kept as a draft by the caller. */
  words: string;
  onWords(words: string): void;
  onDone(result: string): void;
  onCant(why: string): void;
}

/**
 * A task opened: where, what it is, and what to send back, as a form saved as it is typed. 1 · Done sends it; 2 · Can't
 * do it… asks why and closes it as not done. A task of the developer's own has nothing to send back: Done is enough.
 */
export function TaskCard({ task, words, onWords, onDone, onCant }: TaskCardProps) {
  const [cant, setCant] = useState(false);
  const own = task.outcome === "";
  const ready = own || words.trim() !== "";
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task for you · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </p>
      <h3 className="question-title">{task.title}</h3>
      {task.body === "" ? null : <Markdown text={task.body} />}
      <form
        className="task-form"
        aria-label={cant ? "Say why it cannot be done" : "Report the outcome"}
        onSubmit={(event) => {
          event.preventDefault();
          if (cant) {
            if (words.trim() !== "") onCant(words.trim());
            return;
          }
          // The words stay a draft until the task closes, which deletes it: an Undo must not lose them.
          if (ready) onDone(own ? "Done" : words.trim());
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
            <TextBox
              label={cant ? `Why ${task.ref} cannot be done` : `What ${task.ref} found`}
              placeholder={cant ? "Why not" : (task.outcome ?? "What you found")}
              value={words}
              onChange={onWords}
            />
          </>
        )}
        <div className="question-actions">
          {cant ? (
            <>
              <button type="submit" className="btn" data-primary="true" disabled={words.trim() === ""}>
                Close it
              </button>
              <button type="button" className="btn" onClick={() => setCant(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="submit" className="btn" data-tone="attention" data-choice="1" disabled={!ready}>
                {own ? "Done" : "Send · Done"}
              </button>
              <button type="button" className="btn" data-choice="2" onClick={() => setCant(true)}>
                Can't do it…
              </button>
            </>
          )}
        </div>
        {own || cant ? null : (
          <span className="muted">
            Saved as you type, so you can finish on another day or device. Done sends it; Can't do it… asks
            why and closes the task as not done.
          </span>
        )}
      </form>
    </article>
  );
}
