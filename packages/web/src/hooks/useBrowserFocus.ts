import { focusItem } from "../lib/focus.ts";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

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
  const item = target.closest("[data-focus-ref]");
  return item instanceof HTMLElement ? (item.dataset.focusRef ?? null) : null;
}

/**
 * Keeps home's focus and the browser's own focus one and the same. Each time the developer moves home's focus with a
 * key, the browser's focus goes to that item, so Tab moves within it and a screen reader follows; it leaves alone an
 * item already holding the browser's focus, such as a box being typed in. And a click or Tab into an item makes it
 * home's focus. The browser's focus is outside React, so effects bring the two in line.
 *
 * A press moves home's focus only with its click: the browser gives focus as the press goes down, and opening
 * the pressed item then would fold the one open above it, moving the page under the pointer so the press lands on
 * something else. And the item pressed stays where it was on the screen while the one above it folds.
 */
export function useBrowserFocus(
  container: RefObject<HTMLElement | null>,
  focus: string | null,
  moved: number,
  follow: (ref: string) => void,
): void {
  // Where the item pressed sat on the screen as the press ended, until the page has been drawn with the new focus.
  const anchor = useRef<{ ref: string; top: number } | null>(null);
  // Focus just moved by a press, so the item is where the pointer is and the page is not scrolled to show it.
  const pressed = useRef(false);

  // Only a move the developer made, counted by `moved`, takes the browser's focus: focus that moves because its item
  // went away changes home's focus and the keys, never the cursor, and a field being typed in is never left.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus is read when the developer moves it, not when it changes
  useEffect(() => {
    if (moved === 0 || focus === null || container.current === null) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && isTyping(active)) return;
    const target = focusItem(container.current, focus);
    if (target !== undefined && !target.contains(active))
      target.focus(pressed.current ? { preventScroll: true } : undefined);
  }, [container, moved]);

  // Whether the browser's focus was last somewhere on home, kept outside rendering: an item that goes away takes the
  // browser's focus with it without any event, so this is what says home still had it.
  const inside = useRef(false);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const element = container.current;
      inside.current = element !== null && event.target instanceof Node && element.contains(event.target);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [container]);

  // When the item with the browser's focus goes away, as after a choice or as a pressed row opens in place, the
  // browser's focus follows home's to the next item instead of falling to the page; it is never taken from anything
  // else holding it.
  useEffect(() => {
    if (focus === null || container.current === null || !inside.current) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    focusItem(container.current, focus)?.focus(pressed.current ? { preventScroll: true } : undefined);
  }, [container, focus]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs once the page is drawn with the new focus
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    if (held === null || container.current === null) return;
    const item = focusItem(container.current, held.ref);
    if (item === undefined) return;
    const shift = item.getBoundingClientRect().top - held.top;
    if (shift !== 0) window.scrollBy(0, shift);
  }, [container, focus]);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    // A press is held from the pointer going down until its click. A touch screen sends the click, and the focus before
    // it, a while after the finger lifts, so nothing is timed from the lift. A press that ends in no click, a finger
    // that scrolled, is let go by the next key, since only a key moves focus without a pointer. Only the main button
    // presses: a right press opens the browser's menu and ends in no click.
    let pressing = false;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) pressing = true;
    };
    const onKeyDown = () => {
      pressing = false;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (pressing) return;
      const ref = focusRefOf(event.target);
      if (ref !== null) follow(ref);
    };
    const onClick = (event: MouseEvent) => {
      pressing = false;
      const ref = focusRefOf(event.target);
      if (ref === null) return;
      const item = focusItem(element, ref);
      if (item !== undefined) anchor.current = { ref, top: item.getBoundingClientRect().top };
      pressed.current = true;
      follow(ref);
      // Focus that does not change draws nothing, and an anchor left behind would move the page on a later key.
      setTimeout(() => {
        anchor.current = null;
        pressed.current = false;
      });
    };
    element.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("click", onClick, true);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("click", onClick, true);
    };
  }, [container, follow]);
}
