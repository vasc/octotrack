import type { Line, LineCrew } from "@octotrack/core/schemas";
import { useState } from "react";

/** How the owner keeps the line, as E-Line says it: what waits on the developer, and whether it can be woken. */
function keeping(state: string, waitingOnYou: boolean): string {
  const waits = waitingOnYou ? "All the line's open work waits on you, and it" : "It";
  switch (state) {
    case "asleep":
      return `${waits} left a wake address, so it keeps the line while it sleeps and is woken by what you send.`;
    case "running":
      return waitingOnYou
        ? "All the line's open work waits on you; it is running now."
        : "It is running now.";
    case "quiet":
      return "It has been quiet since its last command and cannot be woken; Release is on Agents.";
    default:
      return `It is ${state}.`;
  }
}

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
  waitingOnYou = false,
}: {
  line: Line;
  /** All the line's open work waits on the developer. */
  waitingOnYou?: boolean;
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
            <b>{owner.name}</b> writes the summary and hears what you tell it.{" "}
            {keeping(owner.state, waitingOnYou)}{" "}
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
