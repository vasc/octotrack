import { useState } from "react";

/** A new line goes to the end of up next, with the sentence that says when it is finished. */
export function AddLineForm({ onAdd }: { onAdd(line: { title: string; doneWhen: string }): void }) {
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const ready = title.trim() !== "" && doneWhen.trim() !== "";
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onAdd({ title: title.trim(), doneWhen: doneWhen.trim() });
        setTitle("");
        setDoneWhen("");
      }}
    >
      <input
        className="field"
        aria-label="New line"
        placeholder="A line of work"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        className="field"
        aria-label="Done when"
        placeholder="Done when…"
        value={doneWhen}
        onChange={(event) => setDoneWhen(event.target.value)}
      />
      <button type="submit" className="btn" disabled={!ready}>
        Add line
      </button>
    </form>
  );
}
