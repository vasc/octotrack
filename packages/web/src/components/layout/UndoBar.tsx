import type { PendingChoice } from "@octotrack/core/schemas";

/**
 * Choices still waiting to take effect, newest first, each with Undo and Now; and any that failed when applied, with
 * why, until dismissed. Announced politely to screen readers.
 */
export function UndoBar({
  pending,
  onUndo,
  onNow,
  onPause,
}: {
  pending: readonly PendingChoice[];
  onUndo(id: number): void;
  onNow(id: number): void;
  /** A Stop of a line's owner: undo it, and move the line to up next instead. */
  onPause?: (id: number, line: string) => void;
}) {
  const waiting = pending.filter((choice) => choice.state === "pending");
  const newest = waiting.at(-1)?.id;
  return (
    <div className="undo-bar" role="status" aria-live="polite">
      {[...pending].reverse().map((choice) =>
        choice.state === "failed" ? (
          <div key={choice.id} className="undo-choice" data-failed="true">
            <span role="alert">
              Could not: {choice.summary}. {choice.error ?? ""}
            </span>
            <button type="button" className="btn" onClick={() => onUndo(choice.id)}>
              Dismiss
            </button>
          </div>
        ) : (
          <div key={choice.id} className="undo-choice">
            <span>{choice.summary}</span>
            {choice.line === null ? null : (
              <span className="muted">{choice.line} then looks for another owner</span>
            )}
            {choice.id === newest ? <span className="muted">u to undo</span> : null}
            {choice.line === null || onPause === undefined ? null : (
              <button type="button" className="btn" onClick={() => onPause(choice.id, choice.line ?? "")}>
                Pause {choice.line} instead
              </button>
            )}
            <button type="button" className="btn" onClick={() => onUndo(choice.id)}>
              Undo
            </button>
            <button type="button" className="btn" onClick={() => onNow(choice.id)}>
              Now
            </button>
          </div>
        ),
      )}
    </div>
  );
}
