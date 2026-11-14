import { useEffect } from "react";

export type HotkeyMap = Readonly<Record<string, () => void>>;

/** How long after g the next key still counts as its second half, as in g u. */
const SEQUENCE_MS = 1000;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

function isControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === "BUTTON" || target.tagName === "A");
}

/**
 * The g that may start a two-key sequence, shared by every listener on the page: each sees the same key events, so the
 * second key is read as "g u" by all of them, and none also acts on a bare u.
 */
let prefix: { started: KeyboardEvent; second: KeyboardEvent | null } | null = null;

function nameOf(event: KeyboardEvent): string {
  const key = event.altKey ? `Alt+${event.key}` : event.key;
  if (prefix === null || prefix.started === event) return key;
  const inTime = event.timeStamp - prefix.started.timeStamp < SEQUENCE_MS;
  if (inTime && (prefix.second === null || prefix.second === event)) {
    prefix.second = event;
    return `g ${key}`;
  }
  return key;
}

/**
 * Single-key shortcuts, Alt with a key, and g followed by a key. They stay out of the way while typing and of browser
 * shortcuts that use Cmd or Ctrl.
 */
export function useHotkeys(keys: HotkeyMap): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || isTyping(event.target)) return;
      // Enter on a focused control belongs to that control.
      if (event.key === "Enter" && isControl(event.target)) return;
      const name = nameOf(event);
      if (name === "g" && (prefix === null || prefix.started !== event))
        prefix = { started: event, second: null };
      const action = keys[name];
      if (action === undefined) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keys]);
}
