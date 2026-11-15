import type { DragHandle } from "../../hooks/useDragOrder.ts";
import { Menu, MenuAction } from "../ui/Menu.tsx";

export type Move = "top" | "up" | "down" | "up_next";

/**
 * A line's number in the order, which is also how it moves: drag it onto another line, or open it for Move to top,
 * Up, Down and, on a working line, To up next. Alt with the arrows also moves the focused line.
 */
export function LineHandle({
  title,
  number,
  canMoveUp,
  canMoveDown,
  canQueue = false,
  drag,
  onMove,
}: {
  title: string;
  /** Its place in the order. */
  number: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** A working line can go to up next, which winds its agents down. */
  canQueue?: boolean;
  drag?: DragHandle;
  onMove(direction: Move): void;
}) {
  const enabled: Readonly<Record<Move, boolean>> = {
    top: canMoveUp,
    up: canMoveUp,
    down: canMoveDown,
    up_next: canQueue,
  };
  const first = (["top", "up", "down", "up_next"] as const).find((direction) => enabled[direction]);
  return (
    <Menu
      label={`Move ${title}`}
      menuLabel={`Move ${title}`}
      lead={String(number)}
      align="start"
      {...(drag === undefined
        ? {}
        : {
            drag: {
              onDragStart: (event) => {
                // Some browsers start a drag only when it carries data.
                event.dataTransfer.setData("text/plain", title);
                drag.onDragStart(event);
              },
              onDragEnd: drag.onDragEnd,
            },
          })}
    >
      {(close) =>
        (
          [
            ["top", "Move to top"],
            ["up", "Up"],
            ["down", "Down"],
            ...(canQueue ? [["up_next", "To up next"] as const] : []),
          ] as const
        ).map(([direction, label]) => (
          <MenuAction
            key={direction}
            disabled={!enabled[direction]}
            autoFocus={direction === first}
            onSelect={() => {
              close();
              onMove(direction);
            }}
          >
            {label}
          </MenuAction>
        ))
      }
    </Menu>
  );
}
