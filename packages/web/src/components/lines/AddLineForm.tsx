import { useState } from "react";

/** A new line goes to the end of up next, with the sentence that says when it is finished. */
export function AddLineForm({ onAdd }: { onAdd(line: { title: string; doneWhen: string }): void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const ready = title.trim() !== "" && doneWhen.trim() !== "";
  if (!open) {
    return (
      <div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          New line…
        </button>
      </div>
    );
  }
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onAdd({ title: title.trim(), doneWhen: doneWhen.trim() });
        setTitle("");
        setDoneWhen("");
        setOpen(false);
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
      <button type="submit" className="btn" data-primary="true" disabled={!ready}>
        Add line
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
