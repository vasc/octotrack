import { type PointerEvent, useEffect, useRef, useState } from "react";

/** Where a dragged line lands: before or after the line under the pointer. */
export type DropEdge = "before" | "after";

/** What the handle a line is dragged by needs. */
export interface DragHandle {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  /** A drag just ended on it, so the click that follows is the end of the drag, not a press that opens its menu. */
  dragged(): boolean;
}

/** What a line another can be dropped on carries, and whether the dragged line is over it now. */
export interface DropTarget {
  ref: string;
  section: string;
  edge: DropEdge | null;
}

export interface DragProps {
  handle: DragHandle;
  target: DropTarget;
}

/** Moved this far, a press on the handle is a drag rather than a tap that opens its menu. */
const DRAG_FROM_PX = 6;

interface Dragging {
  ref: string;
  section: string;
  x: number;
  y: number;
  moving: boolean;
}

/**
 * Dragging a line by its handle, with a mouse, a finger or a pen: the line under the pointer, in the same section,
 * shows a rule where it would land, before it in its top half, after it in its bottom half, and letting go moves it
 * there. A press that does not move is a tap, which opens the handle's menu. The pointer is followed on the window,
 * outside React, since a finger's events stay with the element it first touched.
 */
export function useDragOrder(onDrop: (ref: string, place: { before: string } | { after: string }) => void) {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const [over, setOver] = useState<{ ref: string; edge: DropEdge } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    if (dragging === null) return;
    const lineAt = (x: number, y: number): { ref: string; edge: DropEdge } | null => {
      const row = document.elementFromPoint(x, y)?.closest("[data-drop-ref]");
      if (!(row instanceof HTMLElement)) return null;
      const ref = row.dataset.dropRef;
      if (ref === undefined || ref === dragging.ref || row.dataset.dropSection !== dragging.section)
        return null;
      const box = row.getBoundingClientRect();
      return { ref, edge: y < box.top + box.height / 2 ? "before" : "after" };
    };
    const move = (event: globalThis.PointerEvent) => {
      const far = Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) >= DRAG_FROM_PX;
      if (!dragging.moving && !far) return;
      if (!dragging.moving) setDragging({ ...dragging, moving: true });
      setOver(lineAt(event.clientX, event.clientY));
    };
    const end = (event: globalThis.PointerEvent) => {
      if (dragging.moving) {
        justDragged.current = true;
        const landing = event.type === "pointerup" ? lineAt(event.clientX, event.clientY) : null;
        if (landing !== null)
          onDrop(dragging.ref, landing.edge === "before" ? { before: landing.ref } : { after: landing.ref });
      }
      setDragging(null);
      setOver(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, onDrop]);

  return (ref: string, section: string): DragProps => ({
    handle: {
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        justDragged.current = false;
        setDragging({ ref, section, x: event.clientX, y: event.clientY, moving: false });
      },
      dragged: () => {
        const was = justDragged.current;
        justDragged.current = false;
        return was;
      },
    },
    target: { ref, section, edge: over !== null && over.ref === ref ? over.edge : null },
  });
}
