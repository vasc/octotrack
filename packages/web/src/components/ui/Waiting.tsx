import { Button } from "./Button.tsx";

function seconds(dueAt: string, now: number): number {
  return Math.max(1, Math.ceil((Date.parse(dueAt) - now) / 1000));
}

/**
 * A choice made here, waiting a few seconds before it takes effect, said where it was made: what happens and when,
 * with Undo right beside it.
 */
export function Waiting({
  what,
  dueAt,
  now,
  onUndo,
  undoLabel,
}: {
  /** What happens, such as "Sending to New Year trip". */
  what: string;
  dueAt: string;
  now: number;
  onUndo(): void;
  /** Names Undo for a screen reader, where the Undo bar shows one too. */
  undoLabel: string;
}) {
  return (
    // Not a live region: the Undo bar already announces the choice, and the seconds tick too often to read out.
    <div className="ui-waiting">
      <span>
        {what} <span aria-hidden="true">in {seconds(dueAt, now)} s</span>
      </span>
      <Button variant="primary" onClick={onUndo} aria-label={undoLabel}>
        Undo
      </Button>
    </div>
  );
}
