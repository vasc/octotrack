import type { Drift } from "@octotrack/core/schemas";
import { useState } from "react";
import { humanize } from "../../lib/format.ts";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export type DriftMode = "updated" | "verified";

export interface DriftItemProps {
  drift: Drift;
  error?: string | null;
  onAck(ref: string, mode: DriftMode, note: string): void;
}

/** Something out of date. It only goes away with an explanation, whichever way it is cleared. */
export function DriftItem({ drift, error = null, onAck }: DriftItemProps) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  return (
    <article className="drift" aria-label={drift.ref}>
      <div className="row-sub">
        <RefLink value={drift.ref} />
        <Badge>{humanize(drift.rule.replaceAll("-", " "))}</Badge>
        {drift.status === "open" ? null : <StatusBadge value={drift.status} />}
        <span>on</span>
        <RefLink value={drift.target} />
        {drift.assignee === null ? null : <span>for {drift.assignee}</span>}
        <TimeAgo iso={drift.createdAt} />
      </div>
      <div>
        <RefText text={drift.message} />
      </div>
      {drift.status === "open" ? (
        <>
          <div className="drift-suggestion">{drift.suggestion}</div>
          <form className="composer" onSubmit={(event) => event.preventDefault()}>
            <input
              className="field"
              aria-label={`Note for ${drift.ref}`}
              placeholder="What changed, or why nothing needs to"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {/* Drift about state clears by itself once the state is right, so "updated" could only be a false claim. */}
            {drift.edge ? (
              <button
                type="button"
                className="btn"
                disabled={trimmed === ""}
                onClick={() => onAck(drift.ref, "updated", trimmed)}
              >
                Updated
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={trimmed === ""}
              onClick={() => onAck(drift.ref, "verified", trimmed)}
            >
              Nothing to update
            </button>
          </form>
          {error === null ? null : (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </>
      ) : drift.note === null ? null : (
        <p className="muted">
          {drift.resolvedBy}: {drift.note}
        </p>
      )}
    </article>
  );
}
