import { useEffect, useState } from "react";
import {
  APPEARANCE_KEY,
  type Appearance,
  applyAppearance,
  type Mode,
  type Palette,
  readAppearance,
} from "../lib/appearance.ts";

/** Browser storage can be missing or refuse, as in a private window: the page works without it. */
function stored(): string | null {
  try {
    return localStorage.getItem(APPEARANCE_KEY);
  } catch {
    return null;
  }
}

function keep(appearance: Appearance): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    // Not kept on this device; the page still shows it until it closes.
  }
}

/**
 * The theme and mode the developer picked, kept on this device. The page's attributes are outside React, so an effect
 * brings them in line whenever the choice changes.
 */
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance(stored()));
  useEffect(() => {
    applyAppearance(document.documentElement, appearance);
  }, [appearance]);
  const choose = (next: Appearance) => {
    setAppearance(next);
    keep(next);
  };
  return {
    appearance,
    setPalette: (palette: Palette) => choose({ ...appearance, palette }),
    setMode: (mode: Mode) => choose({ ...appearance, mode }),
  };
}
