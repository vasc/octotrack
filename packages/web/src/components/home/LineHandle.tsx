import type { DragHandle } from "../../hooks/useDragOrder.ts";
import { useMenu } from "../../hooks/useMenu.ts";
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
  const menu = useMenu();
  const move = (direction: Move) => {
    menu.close();
    onMove(direction);
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
      onBlur={menu.leave}
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
    <span className="line-handle-wrap" ref={menu.wrap}>
      <button
        ref={menu.button}
        type="button"
        className="line-handle"
        aria-label={`Move ${title}`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        title="Drag to reorder, or click to move"
        draggable
        onDragStart={(event) => {
          // Some browsers start a drag only when it carries data.
          event.dataTransfer.setData("text/plain", title);
          drag?.onDragStart(event);
        }}
        onDragEnd={drag?.onDragEnd}
        onClick={menu.toggle}
        onBlur={menu.leave}
      >
        <Icon name="grip" />
      </button>
      {menu.open ? (
        <div className="menu" role="menu" aria-label={`Move ${title}`} onKeyDown={menu.onMenuKey}>
          {item("top", "Move to top")}
          {item("up", "Up")}
          {item("down", "Down")}
          {canQueue ? item("up_next", "To up next") : null}
        </div>
      ) : null}
    </span>
  );
}
