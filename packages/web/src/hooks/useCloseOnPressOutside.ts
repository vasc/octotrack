import { type RefObject, useEffect } from "react";

/**
 * Drawn over the page and part of what is open, not outside it: a sheet opened from the panel, a menu's list, the
 * Undo bar and its notices.
 */
const PART_OF_IT = ".ui-sheet-layer, .ui-toasts, .ui-menu-list";

/**
 * A press anywhere outside `wrap` closes it, as a tap outside closes a sheet: the page beside a panel is the way out
 * of it. A press on another item in the list still opens that one, since its click arrives after this. The page is
 * outside React, so it is listened to here.
 */
export function useCloseOnPressOutside(wrap: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (wrap.current?.contains(target) === true || target.closest(PART_OF_IT) !== null) return;
      onClose();
    };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [wrap, onClose]);
}
