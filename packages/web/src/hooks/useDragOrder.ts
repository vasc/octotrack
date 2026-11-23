import { type PointerEvent, useEffect, useRef, useState } from "react";

/** Where a dragged line lands: before or after the line under the pointer. */
export type DropEdge = "before" | "after";

/** What the handle a line is dragged by needs. */
export interface DragHandle {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
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
/** This close to the top or bottom of the window, a drag scrolls the page, so a line can go past what is in view. */
const SCROLL_EDGE_PX = 48;
/** How far the page scrolls on each frame while a drag is held at an edge. */
const SCROLL_STEP_PX = 12;

/**
 * The click a browser sends when a drag ends goes to whatever the press and the lift share, which may be the line's
 * own head or its handle: it is the end of the drag, not a press, so it is swallowed before anything sees it. It comes
 * in the same task as the lift, or not at all.
 */
function swallowNextClick(): void {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    done();
  };
  const done = () => window.removeEventListener("click", swallow, true);
  window.addEventListener("click", swallow, true);
  setTimeout(done);
}

/**
 * Dragging a line by its handle, with a mouse, a finger or a pen: the line under the pointer, in the same section,
 * shows a rule where it would land, before it in its top half, after it in its bottom half, and letting go moves it
 * there. A press that does not move is a tap, which opens the handle's menu. Only the pointer that started the drag
 * moves or ends it; Esc cancels it; held near the top or bottom of the window, it scrolls the page. The pointer is
 * followed on the window, outside React, from the press until the lift, since a finger's events stay with the element
 * it first touched.
 */
export function useDragOrder(onDrop: (ref: string, place: { before: string } | { after: string }) => void) {
  const [over, setOver] = useState<{ ref: string; edge: DropEdge } | null>(null);
  // Ends the drag under way, if any: its listeners and its scrolling live outside React.
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const start = (ref: string, section: string, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || stop.current !== null) return;
    const pointer = event.pointerId;
    const from = { x: event.clientX, y: event.clientY };
    let last = from;
    let moving = false;
    let frame = 0;
    const lineAt = (x: number, y: number): { ref: string; edge: DropEdge } | null => {
      const row = document.elementFromPoint(x, y)?.closest("[data-drop-ref]");
      if (!(row instanceof HTMLElement)) return null;
      const at = row.dataset.dropRef;
      if (at === undefined || at === ref || row.dataset.dropSection !== section) return null;
      const box = row.getBoundingClientRect();
      return { ref: at, edge: y < box.top + box.height / 2 ? "before" : "after" };
    };
    const track = () => setOver(lineAt(last.x, last.y));
    const scroll = () => {
      const step =
        last.y < SCROLL_EDGE_PX
          ? -SCROLL_STEP_PX
          : last.y > window.innerHeight - SCROLL_EDGE_PX
            ? SCROLL_STEP_PX
            : 0;
      if (step === 0) {
        frame = 0;
        return;
      }
      window.scrollBy(0, step);
      track();
      frame = requestAnimationFrame(scroll);
    };
    const move = (moved: globalThis.PointerEvent) => {
      if (moved.pointerId !== pointer) return;
      last = { x: moved.clientX, y: moved.clientY };
      if (!moving && Math.hypot(last.x - from.x, last.y - from.y) < DRAG_FROM_PX) return;
      moving = true;
      track();
      if (frame === 0) frame = requestAnimationFrame(scroll);
    };
    const finish = (landing: { ref: string; edge: DropEdge } | null) => {
      cleanup();
      setOver(null);
      if (!moving) return;
      swallowNextClick();
      if (landing !== null)
        onDrop(ref, landing.edge === "before" ? { before: landing.ref } : { after: landing.ref });
    };
    const lift = (lifted: globalThis.PointerEvent) => {
      if (lifted.pointerId !== pointer) return;
      finish(lifted.type === "pointerup" ? lineAt(lifted.clientX, lifted.clientY) : null);
    };
    const key = (pressed: KeyboardEvent) => {
      if (pressed.key !== "Escape" || !moving) return;
      // Esc ends the drag, and only the drag: not the panel or the place it would close otherwise.
      pressed.preventDefault();
      pressed.stopPropagation();
      finish(null);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
      window.removeEventListener("keydown", key, true);
      if (frame !== 0) cancelAnimationFrame(frame);
      stop.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    window.addEventListener("keydown", key, true);
    stop.current = cleanup;
  };

  return (ref: string, section: string): DragProps => ({
    handle: { onPointerDown: (event) => start(ref, section, event) },
    target: { ref, section, edge: over !== null && over.ref === ref ? over.edge : null },
  });
}
