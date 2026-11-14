export type Move = "top" | "up" | "down" | "up_next";

/** To the top, up and down within a section, shown in Reorder mode. */
export function ReorderButtons({
  title,
  canMoveUp,
  canMoveDown,
  canQueue = false,
  onMove,
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** For a working line: to up next, which winds its agents down. */
  canQueue?: boolean;
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
      {canQueue ? (
        <button
          type="button"
          className="btn"
          aria-label={`Move ${title} to up next`}
          onClick={() => onMove("up_next")}
        >
          To up next
        </button>
      ) : null}
    </span>
  );
}
