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

/** A task opened: where, what to report, and its two choices, Done and Can't do it, each asking for its words. */
export function TaskCard({ task, words, onWords, onDone, onCant }: TaskCardProps) {
  const [mode, setMode] = useState<"done" | "cant" | null>(words === "" ? null : "done");
  const ready = words.trim() !== "";
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </p>
      <h3 className="decision-title">{task.title}</h3>
      {task.outcome === null ? null : (
        <p className="decision-context">
          Report: <Markdown text={task.outcome} inline />
        </p>
      )}
      {task.body === "" ? null : <Markdown text={task.body} />}
      {mode === null ? (
        <div className="decision-actions">
          <button type="button" className="btn" data-primary="true" onClick={() => setMode("done")}>
            Done…
          </button>
          <button type="button" className="btn" onClick={() => setMode("cant")}>
            Can't do it…
          </button>
        </div>
      ) : (
        <form
          className="decision-actions"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            // The words stay a draft until the task closes, which deletes it: an Undo must not lose them.
            if (mode === "done") onDone(words.trim());
            else onCant(words.trim());
            setMode(null);
          }}
        >
          <TextBox
            label={mode === "done" ? `What ${task.ref} found` : `Why ${task.ref} cannot be done`}
            placeholder={mode === "done" ? (task.outcome ?? "What you found") : "Why not"}
            value={words}
            onChange={onWords}
          />
          <button type="submit" className="btn" data-primary="true" disabled={!ready}>
            {mode === "done" ? "Send" : "Close it"}
          </button>
          <button type="button" className="btn" onClick={() => setMode(null)}>
            Cancel
          </button>
        </form>
      )}
    </article>
  );
}
