import type { PendingChoice } from "@octotrack/core/schemas";
import { Button } from "../ui/Button.tsx";
import { Toast, Toasts } from "../ui/Toast.tsx";

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

/** What a Stop does to the line its owner leaves. */
function afterStop(line: UndoLine): string {
  return line.waitsOnYou ? `${line.title} waits on you.` : `${line.title} looks for another owner.`;
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
  return (
    <Toasts>
      {[...pending].reverse().map((choice) => {
        if (choice.state === "failed") {
          return (
            <Toast
              key={choice.id}
              failed
              actions={
                <Button variant="quiet" onClick={() => onUndo(choice.id)}>
                  Dismiss
                </Button>
              }
            >
              {choice.summary}. {choice.error ?? "No reason was given."}
            </Toast>
          );
        }
        const line = choice.line === null ? undefined : lines[choice.line];
        return (
          <Toast
            key={choice.id}
            actions={
              <>
                {choice.line === null || onPause === undefined ? null : (
                  <Button onClick={() => onPause(choice.id, choice.line ?? "")}>
                    Pause the line instead
                  </Button>
                )}
                <Button onClick={() => onUndo(choice.id)}>Undo</Button>
              </>
            }
          >
            {choice.summary}{" "}
            {/* The countdown ticks every second; announcing each tick would drown out the rest. */}
            <span aria-hidden="true">{inSeconds(choice.dueAt, now)}</span>
            {line === undefined ? "" : `. ${afterStop(line)}`}
          </Toast>
        );
      })}
    </Toasts>
  );
}
