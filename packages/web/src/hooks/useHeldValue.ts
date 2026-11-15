import { useState } from "react";

/**
 * What a box shows: its value, except while it has focus, when it keeps what was typed in it, so a draft arriving from
 * another device never changes the text under the cursor.
 */
export function useHeldValue(value: string) {
  const [held, setHeld] = useState<string | null>(null);
  return {
    shown: held ?? value,
    onFocus: () => setHeld(value),
    onBlur: () => setHeld(null),
    /** Typing always comes with focus; an unfocused box shows the value as it is. */
    typed: (text: string) => setHeld((current) => (current === null ? null : text)),
  };
}
