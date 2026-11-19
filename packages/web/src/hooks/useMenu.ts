import { type FocusEvent, type KeyboardEvent, type RefObject, useCallback, useRef, useState } from "react";
import { focusLeft, useCloseOnOutsideTap } from "./useCloseOnOutsideTap.ts";

/**
 * A button that opens a short menu of buttons, as a menu behaves anywhere: opened, its first item takes the cursor and
 * the arrows move through the items; Esc closes it and gives the cursor back to the button; focus moving out of the
 * button and its menu, or a tap anywhere else, closes it. The items are the browser's to focus, so their elements are
 * reached through refs.
 *
 * A blur that moves focus nowhere is not leaving, since Safari blurs that way under a tap on an item (see
 * useCloseOnOutsideTap).
 */
export function useMenu(trigger?: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  const own = useRef<HTMLButtonElement>(null);
  const button = trigger ?? own;
  const wrap = useRef<HTMLSpanElement>(null);
  const shut = useCallback(() => setOpen(false), []);
  useCloseOnOutsideTap(wrap, open, shut);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return {
    open,
    button,
    wrap,
    toggle: () => setOpen(!open),
    close,
    /** On the button and each item: focus moving to something outside them closes the menu; focus moving nowhere does not. */
    leave: (event: FocusEvent<HTMLElement>) => {
      if (focusLeft(wrap, event.relatedTarget)) setOpen(false);
    },
    /** On the menu: the arrows move between its items, and Esc closes it. */
    onMenuKey: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll("[role^=menuitem]:not(:disabled)")].filter(
        (item) => item instanceof HTMLButtonElement,
      );
      const active = document.activeElement;
      const at = active instanceof HTMLButtonElement ? items.indexOf(active) : -1;
      items[(at + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    },
  };
}
