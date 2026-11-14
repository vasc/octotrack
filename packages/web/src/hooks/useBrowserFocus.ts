import { type RefObject, useEffect } from "react";

function focusRefOf(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest<HTMLElement>("[data-focus-ref]")?.dataset.focusRef ?? null;
}

/**
 * Keeps home's focus and the browser's own focus one and the same. Each time the developer moves home's focus with a
 * key, the browser's focus goes to that item, so Tab moves within it and a screen reader follows; it leaves alone an
 * item already holding the browser's focus, such as a box being typed in. And a click or Tab into an item makes it
 * home's focus. The browser's focus is outside React, so effects bring the two in line.
 */
export function useBrowserFocus(
  container: RefObject<HTMLElement | null>,
  focus: string | null,
  moved: number,
  follow: (ref: string) => void,
): void {
  useEffect(() => {
    if (moved === 0 || focus === null || container.current === null) return;
    const target = [...container.current.querySelectorAll<HTMLElement>("[data-focus-ref]")].find(
      (element) => element.dataset.focusRef === focus,
    );
    if (target !== undefined && !target.contains(document.activeElement)) target.focus();
  }, [container, focus, moved]);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const onFocusIn = (event: FocusEvent) => {
      const ref = focusRefOf(event.target);
      if (ref !== null) follow(ref);
    };
    element.addEventListener("focusin", onFocusIn);
    return () => element.removeEventListener("focusin", onFocusIn);
  }, [container, follow]);
}
