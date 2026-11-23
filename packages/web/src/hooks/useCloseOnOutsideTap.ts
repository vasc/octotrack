import { type RefObject, useEffect } from "react";

/**
 * While something is open, a tap or click anywhere outside `wrap` closes it, except on what matches `except`, which is
 * drawn elsewhere but belongs to it. The page is outside React, so it is listened to here.
 *
 * `on: "pointerdown"` closes as the press goes down: a menu or a list of completions, which must be gone before the
 * press lands. Closing on blur alone fails in Safari: a tapped button gets no focus there, so what had focus blurs with
 * nothing receiving it before the tap's click arrives, and the list would close under the tap and lose it. With this,
 * a blur that moves focus nowhere can be ignored, since a tap outside still closes it.
 *
 * `on: "click"` closes on a press that both starts and ends outside: a panel beside the page, which a finger scrolling
 * the page, or words selected from inside it out to the page, must leave open.
 */
export function useCloseOnOutsideTap(
  wrap: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  { except, on = "pointerdown" }: { except?: string; on?: "pointerdown" | "click" } = {},
): void {
  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return true;
      if (wrap.current?.contains(target) === true) return false;
      return except === undefined || !(target instanceof Element) || target.closest(except) === null;
    };
    let downOutside = false;
    const down = (event: PointerEvent) => {
      downOutside = outside(event.target);
      if (on === "pointerdown" && downOutside) close();
    };
    const click = (event: MouseEvent) => {
      if (downOutside && outside(event.target)) close();
      downOutside = false;
    };
    document.addEventListener("pointerdown", down);
    if (on === "click") document.addEventListener("click", click);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("click", click);
    };
  }, [open, wrap, close, except, on]);
}

/** Whether a blur moved focus to something outside `wrap`: a blur that moves focus nowhere, as a tap in Safari does, is not leaving. */
export function focusLeft(wrap: RefObject<HTMLElement | null>, to: EventTarget | null): boolean {
  return to instanceof Node && wrap.current?.contains(to) !== true;
}
