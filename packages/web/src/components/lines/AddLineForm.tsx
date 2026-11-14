import { useState } from "react";

export interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
}

/**
 * A new line goes to the end of up next, with the sentence that says when it is finished and the repos its work is in.
 * With no repo it is the developer's own, which no agent takes.
 */
export function AddLineForm({ repos, onAdd }: { repos: readonly string[]; onAdd(line: NewLine): void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [picked, setPicked] = useState<readonly string[]>([]);
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
        onAdd({
          title: title.trim(),
          doneWhen: doneWhen.trim(),
          repos: repos.filter((repo) => picked.includes(repo)),
        });
        setTitle("");
        setDoneWhen("");
        setPicked([]);
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
      {repos.length === 0 ? null : (
        <fieldset className="choice-group">
          <legend className="muted">Repos</legend>
          {repos.map((repo) => (
            <label key={repo} className="check">
              <input
                type="checkbox"
                checked={picked.includes(repo)}
                onChange={(event) =>
                  setPicked(
                    event.target.checked ? [...picked, repo] : picked.filter((other) => other !== repo),
                  )
                }
              />
              {repo}
            </label>
          ))}
        </fieldset>
      )}
      {picked.length === 0 ? (
        <p className="muted">No repo: the line is yours, and no agent takes it.</p>
      ) : null}
      <button type="submit" className="btn" data-primary="true" disabled={!ready}>
        Add line
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}
