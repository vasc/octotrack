import { type FocusEvent, type KeyboardEvent, useRef, useState } from "react";
import type { DragHandle } from "../../hooks/useDragOrder.ts";
import { Icon } from "../ui/Icon.tsx";

export type Move = "top" | "up" | "down" | "up_next";

/**
 * The one way to reorder a line: drag it by this handle onto another, or open it for Move to top, Up, Down and, on a
 * working line, To up next. Opened, the menu takes the cursor and the arrows move through it; Esc closes it and gives
 * the cursor back to the handle. Keyboard, screen reader and phone use the menu; Alt with the arrows also moves the
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
  const handle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    handle.current?.focus();
  };
  const move = (direction: Move) => {
    close();
    onMove(direction);
  };
  // Focus leaving the handle and its menu, by a click or Tab elsewhere, closes the menu.
  const leave = (event: FocusEvent<HTMLButtonElement>) => {
    const wrap = event.currentTarget.closest(".line-handle-wrap");
    if (!(event.relatedTarget instanceof Node && wrap?.contains(event.relatedTarget) === true))
      setOpen(false);
  };
  // The arrows move between the menu's items, as in any menu; the items are the browser's to focus.
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll("[role=menuitem]:not(:disabled)")].filter(
      (item) => item instanceof HTMLButtonElement,
    );
    const active = document.activeElement;
    const at = active instanceof HTMLButtonElement ? items.indexOf(active) : -1;
    const next = items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
    next?.focus();
  };
  const enabled: Readonly<Record<Move, boolean>> = {
    top: canMoveUp,
    up: canMoveUp,
    down: canMoveDown,
    up_next: canQueue,
  };
  const first = (["top", "up", "down", "up_next"] as const).find((direction) => enabled[direction]);
  const item = (direction: Move, label: string) => (
    <button
      type="button"
      role="menuitem"
      onBlur={leave}
      className="menu-item"
      disabled={!enabled[direction]}
      // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on its first item
      autoFocus={direction === first}
      onClick={() => move(direction)}
    >
      {label}
    </button>
  );
  return (
    <span className="line-handle-wrap">
      <button
        ref={handle}
        type="button"
        className="line-handle"
        aria-label={`Move ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Drag to reorder, or click to move"
        draggable
        onDragStart={(event) => {
          // Some browsers start a drag only when it carries data.
          event.dataTransfer.setData("text/plain", title);
          drag?.onDragStart(event);
        }}
        onDragEnd={drag?.onDragEnd}
        onClick={() => setOpen(!open)}
        onBlur={leave}
      >
        <Icon name="grip" />
      </button>
      {open ? (
        <div className="menu" role="menu" aria-label={`Move ${title}`} onKeyDown={onMenuKey}>
          {item("top", "Move to top")}
          {item("up", "Up")}
          {item("down", "Down")}
          {canQueue ? item("up_next", "To up next") : null}
        </div>
      ) : null}
    </span>
  );
}
