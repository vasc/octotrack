import { z } from "zod";

/**
 * The eight themes, Paper first: each a palette in light and dark, defined in design/tokens.css. Paper is our own
 * neutral; six are well-loved editor palettes; High contrast is for sun or low vision.
 */
export const PALETTES = [
  { id: "paper", name: "Paper" },
  { id: "solarized", name: "Solarized" },
  { id: "gruvbox", name: "Gruvbox" },
  { id: "catppuccin", name: "Catppuccin" },
  { id: "rosepine", name: "Rosé Pine" },
  { id: "nord", name: "Nord" },
  { id: "everforest", name: "Everforest" },
  { id: "contrast", name: "High contrast" },
] as const;

export const MODES = [
  { id: "system", name: "As the system" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;

// Each part falls back on its own, so a theme that no longer exists still keeps the mode the device chose.
const Appearance = z.object({
  palette: z
    .enum(["paper", "solarized", "gruvbox", "catppuccin", "rosepine", "nord", "everforest", "contrast"])
    .catch("paper"),
  mode: z.enum(["system", "light", "dark"]).catch("system"),
});
export type Appearance = z.infer<typeof Appearance>;
export type Palette = Appearance["palette"];
export type Mode = Appearance["mode"];

export const DEFAULT_APPEARANCE: Appearance = { palette: "paper", mode: "system" };

/** Where this device keeps the developer's choice; index.html reads it too, so the first paint is already themed. */
export const APPEARANCE_KEY = "octotrack.appearance";

/** What was stored; Paper, or the system's mode, for any part missing or unreadable. */
export function readAppearance(stored: string | null): Appearance {
  if (stored === null) return DEFAULT_APPEARANCE;
  try {
    const parsed = Appearance.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** The theme and mode on the page: Paper and the system's mode need no attribute. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  if (appearance.palette === "paper") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", appearance.palette);
  if (appearance.mode === "system") root.removeAttribute("data-mode");
  else root.setAttribute("data-mode", appearance.mode);
}

/**
 * The browser's own bar, on a phone, in the page's ground: read from the page once its theme is set, so it follows the
 * theme and the mode instead of staying the dark index.html starts with. Nothing to read leaves it as it was.
 */
export function tintBrowserBar(root: HTMLElement): void {
  const ground = root.ownerDocument.defaultView?.getComputedStyle(root).backgroundColor ?? "";
  if (ground === "" || ground === "transparent" || ground === "rgba(0, 0, 0, 0)") return;
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute("content", ground);
}
