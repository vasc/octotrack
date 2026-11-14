import type { Issue } from "@octotrack/core/schemas";
import { useState } from "react";
import { Markdown } from "../ui/Markdown.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface TaskCardProps {
  task: Issue;
  onDone(result: string): void;
  onCant(why: string): void;
}

/** A task opened: where, what to report, and its two choices, Done and Can't do it, each asking for its words. */
export function TaskCard({ task, onDone, onCant }: TaskCardProps) {
  const [mode, setMode] = useState<"done" | "cant" | null>(null);
  const [words, setWords] = useState("");
  const ready = words.trim() !== "";
  return (
    <article className="task" aria-label={task.title}>
      <p className="for-you-kind">
        Task · {task.ref}
        {task.place === null ? "" : ` · at ${task.place}`}
      </p>
      <h3 className="decision-title">{task.title}</h3>
      {task.outcome === null ? null : <p className="decision-context">Report: {task.outcome}</p>}
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
            if (mode === "done") onDone(words.trim());
            else onCant(words.trim());
            setWords("");
            setMode(null);
          }}
        >
          <TextBox
            label={mode === "done" ? `What ${task.ref} found` : `Why ${task.ref} cannot be done`}
            placeholder={mode === "done" ? (task.outcome ?? "What you found") : "Why not"}
            value={words}
            onChange={setWords}
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
