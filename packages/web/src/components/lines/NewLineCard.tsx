import { useState } from "react";
import { TableForm } from "./TableForm.tsx";

export interface NewLine {
  title: string;
  doneWhen: string;
  repos: string[];
  where: "up_next" | "working" | "tabled";
  reason?: string;
  lookAgainAt?: string;
}

/**
 * A line the developer adds: what it is, the sentence that says when it is finished, and the repos its work is in, or
 * that it is theirs. It goes to up next, starts, or is tabled with one button each.
 */
export function NewLineCard({
  repos,
  onAdd,
  onCancel,
}: {
  repos: readonly string[];
  onAdd(line: NewLine): void;
  onCancel(): void;
}) {
  const [title, setTitle] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [mine, setMine] = useState(false);
  const [tabling, setTabling] = useState(false);
  const ready = title.trim() !== "" && doneWhen.trim() !== "" && (mine || picked.length > 0);
  const base = { title: title.trim(), doneWhen: doneWhen.trim(), repos: mine ? [] : [...picked] };
  const unpicked = repos.filter((repo) => !picked.includes(repo));
  return (
    <section className="new-line" aria-label="New line">
      <span className="card-label">New line</span>
      <label className="field-label">
        <span>What it is</span>
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field-label">
        <span>
          Done when{" "}
          <span className="muted">one sentence; an agent may propose a sharper one, for you to accept</span>
        </span>
        <input className="field" value={doneWhen} onChange={(event) => setDoneWhen(event.target.value)} />
      </label>
      <div className="field-label">
        <span>
          Repos <span className="muted">the owner needs one of them; helpers cover the rest</span>
        </span>
        <div className="repo-chips">
          {mine
            ? null
            : picked.map((repo) => (
                <span key={repo} className="repo-chip">
                  {repo}
                  <button
                    type="button"
                    className="repo-chip-remove"
                    aria-label={`Remove ${repo}`}
                    onClick={() => setPicked(picked.filter((other) => other !== repo))}
                  >
                    ×
                  </button>
                </span>
              ))}
          {mine || unpicked.length === 0 ? null : (
            <select
              className="select"
              aria-label="Add a repo"
              value=""
              onChange={(event) => {
                if (event.target.value !== "") setPicked([...picked, event.target.value]);
              }}
            >
              <option value="">Add a repo</option>
              {unpicked.map((repo) => (
                <option key={repo} value={repo}>
                  {repo}
                </option>
              ))}
            </select>
          )}
          <label className="check">
            <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} />
            None: it is mine
          </label>
        </div>
      </div>
      {tabling ? (
        <TableForm
          title={title.trim() === "" ? "the new line" : title.trim()}
          onTable={(reason, lookAgainAt) =>
            onAdd({ ...base, where: "tabled", reason, ...(lookAgainAt === null ? {} : { lookAgainAt }) })
          }
          onCancel={() => setTabling(false)}
        />
      ) : (
        <div className="new-line-actions">
          <span className="muted">
            {mine
              ? "Yours: no agent takes it, and it counts your tasks in to do."
              : "An agent with one of its repos takes it once it is started, and writes its summary."}
          </span>
          <span className="question-actions">
            <button
              type="button"
              className="btn"
              data-primary="true"
              disabled={!ready}
              onClick={() => onAdd({ ...base, where: "up_next" })}
            >
              Add to up next
            </button>
            <button
              type="button"
              className="btn"
              disabled={!ready}
              onClick={() => onAdd({ ...base, where: "working" })}
            >
              Start
            </button>
            <button type="button" className="btn" disabled={!ready} onClick={() => setTabling(true)}>
              Table
            </button>
            <button type="button" className="btn" data-quiet="true" onClick={onCancel}>
              Cancel
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
