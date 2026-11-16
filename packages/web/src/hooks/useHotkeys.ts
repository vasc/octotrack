import { createContext, useContext, useEffect } from "react";

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
 * True while something modal is open over the page, such as the key list: every key map under it stands down, so a
 * stray key behind it costs nothing (D14). The shell, which opens and closes it, sits above and keeps its keys.
 */
const KeysHeld = createContext(false);
export const KeysHeldProvider = KeysHeld.Provider;

/**
 * Sheets open over the page now. Each one holds the keys of everything outside it, which a sheet cannot reach through
 * context since it sits beside the page, not above it; the keys inside it keep acting.
 */
let openSheets = 0;

/** Marks a sheet open until the returned function marks it closed. */
export function holdKeysForSheet(): () => void {
  openSheets += 1;
  return () => {
    openSheets -= 1;
  };
}

/** True inside a sheet: its own keys act while it is open. */
const InSheet = createContext(false);
export const InSheetProvider = InSheet.Provider;

/**
 * Single-key shortcuts, Alt with a key, and g followed by a key. They stay out of the way while typing, of browser
 * shortcuts that use Cmd or Ctrl, and of anything modal open over them.
 */
export function useHotkeys(
  keys: HotkeyMap,
  /** These keys belong to an open sheet, or close one, though they are registered outside it: they act over sheets. */
  { overSheets = false }: { overSheets?: boolean } = {},
): void {
  const held = useContext(KeysHeld);
  const inSheet = useContext(InSheet) || overSheets;
  useEffect(() => {
    if (held) return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || isTyping(event.target)) return;
      // A sheet open over the page holds every key outside it.
      if (openSheets > 0 && !inSheet) return;
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
  }, [keys, held, inSheet]);
}
