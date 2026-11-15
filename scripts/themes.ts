/**
 * Writes every theme's colours into design/tokens.css: `bun scripts/themes.ts`.
 *
 * A theme is seeded with its ground, ink, accent, attention and four statuses in each mode. Its lines, quieter inks,
 * tints and edges are mixed from those, and every colour that is read as text is moved toward the ink until it reaches
 * its contrast on every ground and tint it is drawn on. Change a seed here, run it, and `bun test design` checks the
 * result.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Seed = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  accent: string;
  attention: string;
  good: string;
  bad: string;
  warn: string;
  info: string;
};
type Theme = { id: string; label: string; light: Seed; dark: Seed; lineStrength: number };

const THEMES: readonly Theme[] = [
  {
    id: "paper",
    label: "Paper",
    lineStrength: 1,
    light: seed("#f6f6f4 #ffffff #f9f9f8 #18181b #2b59c3 #a21caf #15803d #b91c1c #a16207 #0f766e"),
    dark: seed("#121212 #1b1b1b #232323 #f2f2f0 #8fb0ff #e879f9 #4ade80 #f87171 #facc15 #5eead4"),
  },
  {
    id: "slate",
    label: "Slate",
    lineStrength: 1,
    light: seed("#e3e9f0 #f4f7fa #ebf0f6 #0f172a #4338ca #0d9488 #15803d #b91c1c #a16207 #a21caf"),
    dark: seed("#0c1219 #141c27 #1b2432 #eef3f8 #a5b4fc #5eead4 #4ade80 #f87171 #fbbf24 #f0abfc"),
  },
  {
    id: "sand",
    label: "Sand",
    lineStrength: 1,
    light: seed("#eee1cb #faf3e6 #f3e9d8 #2a2016 #a64b1f #1d4ed8 #4d7c0f #9f1239 #a16207 #6d28d9"),
    dark: seed("#19130a #231b10 #2c2317 #f6efe3 #f2a37c #93c5fd #a3e635 #fb7185 #facc15 #c4b5fd"),
  },
  {
    id: "forest",
    label: "Forest",
    lineStrength: 1,
    light: seed("#dae8da #eff6ee #e3eee3 #0f2214 #3f6b0c #c026d3 #0f766e #b91c1c #a16207 #1e40af"),
    dark: seed("#09150c #0f1f13 #15281a #eaf5ec #a3e635 #f0abfc #5eead4 #fca5a5 #fde047 #93c5fd"),
  },
  {
    id: "ocean",
    label: "Ocean",
    lineStrength: 1,
    light: seed("#d7e6f5 #eef5fd #e2edf9 #0a1a2e #035f92 #7c3aed #047857 #b91c1c #a16207 #be185d"),
    dark: seed("#06101c #0c1829 #122136 #e8f1fc #38bdf8 #c4b5fd #34d399 #f87171 #fde047 #f9a8d4"),
  },
  {
    id: "plum",
    label: "Plum",
    lineStrength: 1,
    light: seed("#e7dcef #f6f0fa #ede4f4 #1e1426 #7322b8 #2563eb #15803d #be123c #a16207 #0f766e"),
    dark: seed("#130b18 #1c1222 #25182c #f5eef9 #c69cfa #bfdbfe #4ade80 #fb7185 #facc15 #5eead4"),
  },
  {
    id: "rose",
    label: "Rose",
    lineStrength: 1,
    light: seed("#f2dde1 #fbf1f3 #f6e6ea #26141a #b0164f #0f766e #15803d #b91c1c #a16207 #1d4ed8"),
    dark: seed("#190b0f #231217 #2d191f #fbeef0 #f58bb9 #2dd4bf #4ade80 #f87171 #facc15 #93c5fd"),
  },
  {
    id: "contrast",
    label: "High contrast",
    lineStrength: 1.9,
    light: seed("#ffffff #ffffff #f0f0f0 #000000 #0000cc #8000a0 #006b00 #b00000 #7a4f00 #006a6a"),
    dark: seed("#000000 #000000 #121212 #ffffff #00ffff #ffff00 #00ff66 #ff6b6b #ffb000 #d9a6ff"),
  },
];

/** Every colour token, in the order a theme block lists them. */
export const COLOR_TOKENS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--line",
  "--line-faint",
  "--line-strong",
  "--line-field",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--accent",
  "--accent-soft",
  "--on-accent",
  "--attention",
  "--attention-soft",
  "--attention-line",
  "--good",
  "--good-soft",
  "--bad",
  "--bad-soft",
  "--bad-line",
  "--warn",
  "--warn-soft",
  "--info",
  "--info-soft",
  "--info-line",
] as const;
type ColorToken = (typeof COLOR_TOKENS)[number];

function seed(values: string): Seed {
  const [bg, surface, surface2, ink, accent, attention, good, bad, warn, info, ...rest] = values.split(" ");
  if (
    bg === undefined ||
    surface === undefined ||
    surface2 === undefined ||
    ink === undefined ||
    accent === undefined ||
    attention === undefined ||
    good === undefined ||
    bad === undefined ||
    warn === undefined ||
    info === undefined ||
    rest.length > 0
  ) {
    throw new Error(`A seed is ten colours: ${values}`);
  }
  return { bg, surface, surface2, ink, accent, attention, good, bad, warn, info };
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function toHex(values: readonly number[]): string {
  return `#${values
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** `a` moved toward `b` by `amount`, 0 to 1. */
export function mix(a: string, b: string, amount: number): string {
  const from = channels(a);
  const to = channels(b);
  return toHex(from.map((value, index) => value + ((to[index] ?? value) - value) * amount));
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

export function contrast(a: string, b: string): number {
  const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** `color` moved toward `toward` in small steps until it reaches `need` on every ground. */
function reach(color: string, toward: string, grounds: readonly string[], need = 4.7): string {
  const worst = (candidate: string) => Math.min(...grounds.map((ground) => contrast(candidate, ground)));
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, toward, step / 100);
    if (worst(candidate) >= need) return candidate;
  }
  throw new Error(`${color} cannot reach ${need} on ${grounds.join(", ")}`);
}

function colors(theme: Seed, dark: boolean, strength: number): Record<ColorToken, string> {
  const grounds = [theme.bg, theme.surface, theme.surface2];
  const tint = dark ? 0.2 : 0.13;
  // Tints and edges take the seed itself, not the text colour darkened to read. In light, they are mixed from white,
  // since a hue mixed into a ground of another hue turns grey, as orange does on Ocean's blue.
  const base = dark ? theme.surface : "#ffffff";
  const hue = (color: string) => {
    const soft = mix(base, color, tint);
    const text = reach(color, theme.ink, [...grounds, soft]);
    return { text, soft, line: mix(base, color, dark ? 0.45 : 0.5) };
  };
  const accent = hue(theme.accent);
  const attention = hue(theme.attention);
  const good = hue(theme.good);
  const bad = hue(theme.bad);
  const warn = hue(theme.warn);
  const info = hue(theme.info);
  const tints = [accent.soft, attention.soft, good.soft, bad.soft, warn.soft, info.soft];
  const light = dark ? theme.bg : "#ffffff";
  const onAccent = contrast(light, accent.text) >= 4.7 ? light : theme.ink;
  if (contrast(onAccent, accent.text) < 4.7) throw new Error(`Nothing reads on ${accent.text}`);
  if (contrast(theme.surface, bad.text) < 4.5) throw new Error(`The surface does not read on ${bad.text}`);
  return {
    "--bg": theme.bg,
    "--surface": theme.surface,
    "--surface-2": theme.surface2,
    "--line": mix(theme.bg, theme.ink, Math.min(0.13 * strength, 0.6)),
    "--line-faint": mix(theme.surface, theme.ink, Math.min(0.06 * strength, 0.3)),
    "--line-strong": mix(theme.bg, theme.ink, Math.min(0.21 * strength, 0.7)),
    "--line-field": mix(theme.bg, theme.ink, Math.min(0.42 * strength, 0.8)),
    "--ink": theme.ink,
    "--ink-2": reach(mix(theme.ink, theme.bg, 0.24), theme.ink, [...grounds, ...tints], 7),
    "--ink-3": reach(mix(theme.ink, theme.bg, 0.42), theme.ink, [...grounds, ...tints]),
    "--accent": accent.text,
    "--accent-soft": accent.soft,
    "--on-accent": onAccent,
    "--attention": attention.text,
    "--attention-soft": attention.soft,
    "--attention-line": attention.line,
    "--good": good.text,
    "--good-soft": good.soft,
    "--bad": bad.text,
    "--bad-soft": bad.soft,
    "--bad-line": bad.line,
    "--warn": warn.text,
    "--warn-soft": warn.soft,
    "--info": info.text,
    "--info-soft": info.soft,
    "--info-line": info.line,
  };
}

function lines(theme: Theme): string[] {
  const light = colors(theme.light, false, theme.lineStrength);
  const dark = colors(theme.dark, true, theme.lineStrength);
  return COLOR_TOKENS.map((token) => `  ${token}: light-dark(${light[token]}, ${dark[token]});`);
}

if (import.meta.main) {
  const path = join(import.meta.dir, "..", "design", "tokens.css");
  let css = readFileSync(path, "utf8");
  const [paper, ...others] = THEMES;
  if (paper === undefined) throw new Error("No themes");
  // Paper is :root: each colour line is rewritten in place, so the comments between them stay.
  for (const line of lines(paper)) {
    const token = line.trim().split(":")[0] ?? "";
    const pattern = new RegExp(`^  ${token}: light-dark\\([^)]*\\);$`, "m");
    if (!pattern.test(css)) throw new Error(`${token} is not in :root`);
    css = css.replace(pattern, line);
  }
  const start = css.indexOf("/* Slate. */");
  const end = css.indexOf("/* The mode the developer picked");
  if (start < 0 || end < 0) throw new Error("The theme blocks are not where they were");
  const blocks = others
    .map(
      (theme) => `/* ${theme.label}. */\n[data-palette="${theme.id}"] {\n${lines(theme).join("\n")}\n}\n\n`,
    )
    .join("");
  writeFileSync(path, css.slice(0, start) + blocks + css.slice(end));
}
