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
    <div className="ui-waiting" role="status">
      <span className="ui-waiting-text">
        {what} in {seconds(dueAt, now)} s
      </span>
      <Button variant="primary" onClick={onUndo} aria-label={undoLabel}>
        Undo
      </Button>
    </div>
  );
}
