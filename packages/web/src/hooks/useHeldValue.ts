import { useState } from "react";

/**
 * What a box shows: its value, except while it has focus, when it keeps what was typed in it, so a draft arriving from
 * another device never changes the text under the cursor. One change comes through even then: the draft emptying, as
 * when its words were sent, so the box never shows words already gone, for a second send to act on.
 */
export function useHeldValue(value: string) {
  const [held, setHeld] = useState<string | null>(null);
  // The value as last seen, to notice it emptying: adjusted while rendering, as React does for props that change.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
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
