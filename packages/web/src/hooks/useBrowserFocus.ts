import { type RefObject, useEffect } from "react";

function isTyping(element: HTMLElement): boolean {
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}

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
  // Only a move the developer made, counted by `moved`, takes the browser's focus: focus that moves because its item
  // went away changes home's focus and the keys, never the cursor, and a field being typed in is never left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus is read when the developer moves it, not when it changes
  useEffect(() => {
    if (moved === 0 || focus === null || container.current === null) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && isTyping(active)) return;
    const target = [...container.current.querySelectorAll<HTMLElement>("[data-focus-ref]")].find(
      (element) => element.dataset.focusRef === focus,
    );
    if (target !== undefined && !target.contains(active)) target.focus();
  }, [container, moved]);

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
