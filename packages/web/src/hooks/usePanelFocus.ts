import { type RefObject, useEffect, useRef } from "react";

/**
 * Moves the browser's focus into the panel when it opens, so Tab and a screen reader start there, and gives it back to
 * whatever opened it when it closes. A box that took the cursor as the panel opened, such as Tell opened with t, keeps
 * it. The browser's focus is outside React, so an effect brings it in line; what opened the panel is kept in a ref,
 * since nothing on screen depends on it.
 */
export function usePanelFocus(panel: RefObject<HTMLElement | null>, entity: string | null): void {
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (entity === null) {
      const back = opener.current;
      opener.current = null;
      const lost = active === null || active === document.body;
      if (back instanceof HTMLElement && back.isConnected && lost) back.focus();
      return;
    }
    // Moving from one panel to another, as back to the ref it was opened from, keeps the first opener.
    if (opener.current === null) opener.current = active;
    const element = panel.current;
    if (element !== null && !element.contains(active)) element.focus();
  }, [panel, entity]);
}
