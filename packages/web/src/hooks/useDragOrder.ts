import { type DragEvent, useState } from "react";

export interface DragProps {
  draggable: true;
  onDragStart(): void;
  onDragOver(event: DragEvent): void;
  onDrop(event: DragEvent): void;
  onDragEnd(): void;
}

/**
 * Dragging a line by its handle onto another: it lands before the one it is dropped on, within its own section. The
 * line being dragged is page state; the drop is the developer's order like any other move.
 */
export function useDragOrder(onDrop: (ref: string, before: string) => void) {
  const [dragging, setDragging] = useState<{ ref: string; section: string } | null>(null);
  return (ref: string, section: string): DragProps => ({
    draggable: true,
    onDragStart: () => setDragging({ ref, section }),
    onDragOver: (event) => {
      // Only within its own section: across sections is a move, which has its own buttons.
      if (dragging !== null && dragging.section === section && dragging.ref !== ref) event.preventDefault();
    },
    onDrop: (event) => {
      event.preventDefault();
      if (dragging !== null && dragging.section === section && dragging.ref !== ref)
        onDrop(dragging.ref, ref);
      setDragging(null);
    },
    onDragEnd: () => setDragging(null),
  });
}
