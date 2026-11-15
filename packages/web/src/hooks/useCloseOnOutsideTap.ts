import { type RefObject, useEffect } from "react";

/**
 * While something is open, a tap or click anywhere outside `wrap` closes it. The page is outside React, so it is
 * listened to here.
 *
 * Closing on blur alone fails in Safari: a tapped button gets no focus there, so what had focus blurs with nothing
 * receiving it before the tap's click arrives, and the menu or list would close under the tap and lose it. With this,
 * a blur that moves focus nowhere can be ignored, since a tap outside still closes it.
 */
export function useCloseOnOutsideTap(
  wrap: RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: (open: false) => void,
): void {
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || wrap.current?.contains(event.target) !== true) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, wrap, setOpen]);
}

/** Whether a blur moved focus to something outside `wrap`: a blur that moves focus nowhere, as a tap in Safari does, is not leaving. */
export function focusLeft(wrap: RefObject<HTMLElement | null>, to: EventTarget | null): boolean {
  return to instanceof Node && wrap.current?.contains(to) !== true;
}
