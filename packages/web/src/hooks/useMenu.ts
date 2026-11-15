import { type FocusEvent, type KeyboardEvent, type RefObject, useRef, useState } from "react";

/**
 * A button that opens a short menu of buttons, as a menu behaves anywhere: opened, its first item takes the cursor and
 * the arrows move through the items; Esc closes it and gives the cursor back to the button; focus leaving the button
 * and its menu closes it. The items are the browser's to focus, so their elements are reached through refs.
 */
export function useMenu(trigger?: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  const own = useRef<HTMLButtonElement>(null);
  const button = trigger ?? own;
  const wrap = useRef<HTMLSpanElement>(null);
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
    /** On the button and each item: focus going anywhere outside them closes the menu. */
    leave: (event: FocusEvent<HTMLElement>) => {
      const inside =
        event.relatedTarget instanceof Node && wrap.current?.contains(event.relatedTarget) === true;
      if (!inside) setOpen(false);
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
