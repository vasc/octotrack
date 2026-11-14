import type { PendingChoice } from "@octotrack/core/schemas";

/** Choices still waiting to take effect, newest first, each with Undo. Announced politely to screen readers. */
export function UndoBar({
  pending,
  onUndo,
  onNow,
}: {
  pending: readonly PendingChoice[];
  onUndo(id: number): void;
  onNow(id: number): void;
}) {
  return (
    <div className="undo-bar" role="status" aria-live="polite">
      {[...pending].reverse().map((choice, index) => (
        <div key={choice.id} className="undo-choice">
          <span>{choice.summary}</span>
          {index === 0 ? <span className="muted">u to undo</span> : null}
          <button type="button" className="btn" onClick={() => onUndo(choice.id)}>
            Undo
          </button>
          <button type="button" className="btn" onClick={() => onNow(choice.id)}>
            Now
          </button>
        </div>
      ))}
    </div>
  );
}
