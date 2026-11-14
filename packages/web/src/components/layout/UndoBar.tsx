import type { PendingChoice } from "@octotrack/core/schemas";

/** What the Undo bar needs to know about a line a Stop would leave without its owner. */
export interface UndoLine {
  title: string;
  /** All its open work waits on the developer, so the owner search holds off until they answer. */
  waitsOnYou: boolean;
}

function inSeconds(dueAt: string, now: number): string {
  const seconds = Math.max(1, Math.ceil((Date.parse(dueAt) - now) / 1000));
  return `in ${seconds} second${seconds === 1 ? "" : "s"}`;
}

/** What a Stop does to the line its owner leaves, as E-States says it. */
function afterStop(line: UndoLine): string {
  return line.waitsOnYou
    ? `${line.title} waits on you, so no new session starts until you answer.`
    : `${line.title} then looks for another owner.`;
}

/**
 * Choices still waiting to take effect, newest first, each saying what it does and when, with Undo; and any that
 * failed when applied, with why, until dismissed. Announced politely to screen readers.
 */
export function UndoBar({
  pending,
  now,
  lines,
  onUndo,
  onPause,
}: {
  pending: readonly PendingChoice[];
  /** The time now, in milliseconds, for the countdown. */
  now: number;
  lines: Readonly<Record<string, UndoLine>>;
  onUndo(id: number): void;
  /** A Stop of a line's owner: undo it, and move the line to up next instead. */
  onPause?: (id: number, line: string) => void;
}) {
  const waiting = pending.filter((choice) => choice.state === "pending");
  const newest = waiting.at(-1)?.id;
  return (
    <div className="undo-bar" role="status" aria-live="polite">
      {[...pending].reverse().map((choice) => {
        if (choice.state === "failed") {
          return (
            <div key={choice.id} className="undo-choice" data-failed="true">
              <span role="alert">
                {choice.summary} did not happen: {choice.error ?? "no reason was given"}
              </span>
              <button type="button" className="btn" onClick={() => onUndo(choice.id)}>
                Dismiss
              </button>
            </div>
          );
        }
        const line = choice.line === null ? undefined : lines[choice.line];
        return (
          <div key={choice.id} className="undo-choice">
            <span>
              {choice.summary}{" "}
              {/* The countdown ticks every second; announcing each tick would drown out the rest. */}
              <span aria-hidden="true">{inSeconds(choice.dueAt, now)}</span>
              {line === undefined ? "" : `. ${afterStop(line)}`}
            </span>
            {choice.id === newest ? <span className="muted">u to undo</span> : null}
            {choice.line === null || onPause === undefined ? null : (
              <button type="button" className="btn" onClick={() => onPause(choice.id, choice.line ?? "")}>
                Pause the line instead
              </button>
            )}
            <button type="button" className="btn" onClick={() => onUndo(choice.id)}>
              Undo
            </button>
          </div>
        );
      })}
    </div>
  );
}
