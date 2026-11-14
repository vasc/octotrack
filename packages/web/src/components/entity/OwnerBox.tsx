import type { Line, LineCrew } from "@octotrack/core/schemas";
import { useState } from "react";

/**
 * Who speaks for the line: its owner and how it is, its helpers; Stop on the owner, and I'll own it; or, on a line the
 * developer owns, Hand to an agent, which asks for repos only when the line names none.
 */
export function OwnerBox({
  line,
  crew,
  repos,
  onStop,
  onOwn,
  onHand,
}: {
  line: Line;
  crew: LineCrew | undefined;
  repos: readonly string[];
  onStop(name: string): void;
  onOwn(): void;
  onHand(repos: string[]): void;
}) {
  const [handing, setHanding] = useState<readonly string[] | null>(null);
  const owner = crew?.owner ?? null;
  const helpers = crew?.helpers ?? [];
  if (line.state !== "working") return null;
  return (
    <section className="panel-section" aria-label="Owner">
      <h2 className="panel-label">Owner</h2>
      <p className="panel-prose">
        {line.ownedBy !== null ? (
          <>
            <b>You</b> own it. No agent writes to it until you hand it back.
          </>
        ) : owner === null ? (
          <>No agent owns it yet. Octotrack is looking for one.</>
        ) : (
          <>
            <b>{owner.name}</b>, {owner.state}, writes the summary and hears what you tell it.{" "}
            {helpers.length === 0
              ? "Helpers may work under it, never writing the summary; none now."
              : `Helping: ${helpers.map((helper) => helper.name).join(", ")}.`}
          </>
        )}
      </p>
      {handing === null ? (
        <div className="question-actions">
          {owner === null ? null : (
            <button type="button" className="btn" onClick={() => onStop(owner.name)}>
              Stop {owner.name}
            </button>
          )}
          {line.ownedBy === null ? (
            <button type="button" className="btn" onClick={onOwn}>
              I'll own it
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              // A line that names its repos goes straight back; one that names none asks which first.
              onClick={() => (line.repos.length > 0 ? onHand([]) : setHanding([]))}
            >
              Hand to an agent
            </button>
          )}
        </div>
      ) : (
        <fieldset className="choice-group">
          <legend className="muted">Its repos, so an agent can take it</legend>
          {repos.map((repo) => (
            <label key={repo} className="check">
              <input
                type="checkbox"
                checked={handing.includes(repo)}
                onChange={(event) =>
                  setHanding(
                    event.target.checked ? [...handing, repo] : handing.filter((other) => other !== repo),
                  )
                }
              />
              {repo}
            </label>
          ))}
          <button
            type="button"
            className="btn"
            data-primary="true"
            disabled={handing.length === 0}
            onClick={() => {
              onHand([...handing]);
              setHanding(null);
            }}
          >
            Hand over
          </button>
          <button type="button" className="btn" onClick={() => setHanding(null)}>
            Cancel
          </button>
        </fieldset>
      )}
    </section>
  );
}
