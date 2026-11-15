import { useState } from "react";

/**
 * What a box shows: its value, except while it has focus, when it keeps what was typed in it, so a draft arriving from
 * another device never changes the text under the cursor. Two changes come through even then: the draft emptying, as
 * when its words were sent, so the box never shows words already gone, for a second send to act on; and a replacement
 * made on purpose here, counted by `replaced`, such as Record answers keeping only the lines that failed.
 */
export function useHeldValue(value: string, replaced = 0) {
  const [held, setHeld] = useState<string | null>(null);
  // The value as last seen, to notice it emptying: adjusted while rendering, as React does for props that change.
  const [seen, setSeen] = useState(value);
  const [seenReplaced, setSeenReplaced] = useState(replaced);
  if (replaced !== seenReplaced) {
    setSeenReplaced(replaced);
    setSeen(value);
    if (held !== null) setHeld(value);
  } else if (value !== seen) {
    setSeen(value);
    if (value === "" && held !== null && held !== "") setHeld("");
  }
  return {
    shown: held ?? value,
    onFocus: () => setHeld(value),
    onBlur: () => setHeld(null),
    /** Typing always comes with focus; an unfocused box shows the value as it is. */
    typed: (text: string) => setHeld((current) => (current === null ? null : text)),
  };
}
