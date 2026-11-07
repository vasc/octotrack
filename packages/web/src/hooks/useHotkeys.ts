import { useEffect } from "react";

export type HotkeyMap = Readonly<Record<string, () => void>>;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function isControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "BUTTON" || target.tagName === "A");
}

/** Single-key shortcuts. They stay out of the way while typing and of browser shortcuts using modifiers. */
export function useHotkeys(keys: HotkeyMap): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      // Enter on a focused control belongs to that control.
      if (event.key === "Enter" && isControl(event.target)) return;
      const action = keys[event.key];
      if (action === undefined) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keys]);
}
