import { type FocusEvent, useState } from "react";
import type { DragHandle } from "../../hooks/useDragOrder.ts";
import { Icon } from "../ui/Icon.tsx";

export type Move = "top" | "up" | "down" | "up_next";

/**
 * The one way to reorder a line: drag it by this handle onto another, or open it for Move to top, Up, Down and, on a
 * working line, To up next. Keyboard, screen reader and phone use the menu; Alt with the arrows also moves the
 * focused line.
 */
export function LineHandle({
  title,
  canMoveUp,
  canMoveDown,
  canQueue = false,
  drag,
  onMove,
}: {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** A working line can go to up next, which winds its agents down. */
  canQueue?: boolean;
  drag?: DragHandle;
  onMove(direction: Move): void;
}) {
  const [open, setOpen] = useState(false);
  const move = (direction: Move) => {
    setOpen(false);
    onMove(direction);
  };
  // Focus leaving the handle and its menu, by a click or Tab elsewhere, closes the menu.
  const leave = (event: FocusEvent<HTMLButtonElement>) => {
    const wrap = event.currentTarget.closest(".line-handle-wrap");
    if (!(event.relatedTarget instanceof Node && wrap?.contains(event.relatedTarget) === true))
      setOpen(false);
  };
  const item = (direction: Move, label: string, enabled: boolean) => (
    <button
      type="button"
      role="menuitem"
      onBlur={leave}
      className="menu-item"
      disabled={!enabled}
      onClick={() => move(direction)}
    >
      {label}
    </button>
  );
  return (
    <span className="line-handle-wrap">
      <button
        type="button"
        className="line-handle"
        aria-label={`Move ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Drag to reorder, or click to move"
        draggable
        onDragStart={drag?.onDragStart}
        onDragEnd={drag?.onDragEnd}
        onClick={() => setOpen(!open)}
        onBlur={leave}
      >
        <Icon name="grip" />
      </button>
      {open ? (
        <div
          className="menu"
          role="menu"
          aria-label={`Move ${title}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          {item("top", "Move to top", canMoveUp)}
          {item("up", "Up", canMoveUp)}
          {item("down", "Down", canMoveDown)}
          {canQueue ? item("up_next", "To up next", true) : null}
        </div>
      ) : null}
    </span>
  );
}
