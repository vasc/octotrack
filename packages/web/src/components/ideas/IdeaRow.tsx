import type { Horizon, Idea } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";

const HORIZONS: readonly Horizon[] = ["none", "now", "next", "later"];

export interface IdeaRowProps {
  idea: Idea;
  onHorizon(ref: string, horizon: Horizon): void;
  onPromote(ref: string): void;
  onReject(ref: string): void;
}

export function IdeaRow({ idea, onHorizon, onPromote, onReject }: IdeaRowProps) {
  const live = idea.status !== "promoted" && idea.status !== "rejected";
  return (
    <div className="row">
      <RefLink value={idea.ref} />
      <button type="button" className="row-title" onClick={() => openEntity(idea.ref)}>
        {idea.title}
      </button>
      {idea.project === null ? null : <span className="muted">{idea.project}</span>}
      {idea.promotedTo === null ? null : <RefLink value={idea.promotedTo} />}
      <StatusBadge value={idea.status} />
      {live ? (
        <>
          <select
            className="select"
            aria-label={`Roadmap horizon of ${idea.ref}`}
            value={idea.horizon}
            onChange={(event) => {
              const next = HORIZONS.find((horizon) => horizon === event.target.value);
              if (next !== undefined) onHorizon(idea.ref, next);
            }}
          >
            {HORIZONS.map((horizon) => (
              <option key={horizon} value={horizon}>
                {horizon === "none" ? "unplaced" : horizon}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={idea.project === null}
            onClick={() => onPromote(idea.ref)}
          >
            Promote
          </button>
          <button type="button" className="btn" onClick={() => onReject(idea.ref)}>
            Reject
          </button>
        </>
      ) : null}
    </div>
  );
}
