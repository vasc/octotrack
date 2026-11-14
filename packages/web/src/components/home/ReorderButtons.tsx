export type Move = "top" | "up" | "down";

/** To the top, up and down within a section, shown in Reorder mode. */
export function ReorderButtons({
  title,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove(direction: Move): void;
}) {
  return (
    <span className="reorder">
      <button
        type="button"
        className="btn"
        aria-label={`Move ${title} to the top`}
        disabled={!canMoveUp}
        onClick={() => onMove("top")}
      >
        ⤒
      </button>
      <button
        type="button"
        className="btn"
        aria-label={`Move ${title} up`}
        disabled={!canMoveUp}
        onClick={() => onMove("up")}
      >
        ↑
      </button>
      <button
        type="button"
        className="btn"
        aria-label={`Move ${title} down`}
        disabled={!canMoveDown}
        onClick={() => onMove("down")}
      >
        ↓
      </button>
    </span>
  );
}
