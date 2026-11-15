import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const tokensCss = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
// The dashboard's stylesheets: its pages' and its primitives', held to the same language.
const stylesCss = ["styles.css", "ui.css", "design/design.css"]
  .map((file) => readFileSync(join(ROOT, "packages/web/src", file), "utf8"))
  .join("\n");
const COMPONENTS = join(ROOT, "packages/web/src/components");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const rootBlock = /:root \{([\s\S]*?)\n\}/.exec(tokensCss)?.[1] ?? "";
const tokenNames = [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+):/gm)].flatMap((match) => match[1] ?? []);

/** Each theme's own block: every colour, redefined over Paper, which is :root. */
const palettes = new Map(
  [...tokensCss.matchAll(/\[data-palette="([a-z]+)"\] \{([\s\S]*?)\n\}/g)].map(
    (match) => [match[1] ?? "", match[2] ?? ""] as const,
  ),
);
/** Every colour Paper defines: a theme chooses all of them, so none is left at Paper's value in another theme. */
const COLOR_TOKENS = [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+): light-dark\(/gm)].flatMap(
  (match) => match[1] ?? [],
);

function hexOf(name: string, theme: "light" | "dark", palette = "paper"): string {
  const pattern = new RegExp(`${name}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\);`);
  const match = pattern.exec(palettes.get(palette) ?? "") ?? pattern.exec(rootBlock);
  const value = theme === "light" ? match?.[1] : match?.[2];
  if (value === undefined) throw new Error(`${name} is not a light-dark() color`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: string, b: string): number {
  const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** The hue of a colour, 0 to 360 degrees. */
function hueOf(hex: string): number {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map(
    (start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const high = Math.max(red, green, blue);
  const span = high - Math.min(red, green, blue);
  if (span === 0) return 0;
  const sector =
    high === red
      ? ((green - blue) / span) % 6
      : high === green
        ? (blue - red) / span + 2
        : (red - green) / span + 4;
  return (sector * 60 + 360) % 360;
}

const TEXT = 4.5;
const FOCUS_RING = 3;

/** Every pairing the components really use: [foreground, background, minimum]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ...["--bg", "--surface", "--surface-2"].flatMap((ground) =>
    ["--ink", "--ink-2", "--ink-3"].map((ink) => [ink, ground, TEXT] as const),
  ),
  ...["--bg", "--surface", "--surface-2", "--accent-soft"].map(
    (ground) => ["--accent", ground, TEXT] as const,
  ), // Links, a chosen item.
  ["--on-accent", "--accent", TEXT], // The primary button, the page you are on.
  ["--ink", "--accent-soft", TEXT], // An item under the pointer in a menu.
  ["--surface", "--bad", TEXT], // A button that ends something.
  ["--attention", "--attention-soft", TEXT],
  ["--attention", "--bg", TEXT],
  ["--attention", "--surface", TEXT],
  ["--ink", "--attention-soft", TEXT], // A chosen option.
  ["--good", "--good-soft", TEXT],
  ["--bad", "--bad-soft", TEXT],
  ["--warn", "--warn-soft", TEXT],
  ["--info", "--info-soft", TEXT],
  ["--bad", "--bg", TEXT], // Error text.
  ["--bad", "--surface", TEXT],
  ["--accent", "--bg", FOCUS_RING],
  ["--accent", "--surface", FOCUS_RING],
];

describe("contrast", () => {
  const themes = ["paper", ...palettes.keys()];
  test.each(
    themes.flatMap((palette) =>
      PAIRS.flatMap((pair) => (["light", "dark"] as const).map((mode) => [...pair, mode, palette] as const)),
    ),
  )("%s on %s reaches %d in %s %s", (foreground, background, minimum, mode, palette) => {
    const ratio = contrast(hexOf(foreground, mode, palette), hexOf(background, mode, palette));
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });

  test("there are eight themes, Paper and seven more, each choosing every colour", () => {
    expect(themes).toHaveLength(8);
    expect(COLOR_TOKENS).toContain("--accent");
    expect(COLOR_TOKENS).toContain("--attention");
    for (const [palette, block] of palettes) {
      const names = [...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((match) => match[1]);
      expect({ palette, names }).toEqual({ palette, names: COLOR_TOKENS });
    }
  });

  test("what agents propose is drawn in the theme's own colour, not a hue every theme shares", () => {
    for (const palette of themes) {
      for (const mode of ["light", "dark"] as const) {
        const pick = (token: string) => hexOf(token, mode, palette);
        expect({ palette, mode, info: pick("--info"), soft: pick("--info-soft") }).toEqual({
          palette,
          mode,
          info: pick("--accent"),
          soft: pick("--accent-soft"),
        });
      }
    }
  });

  test("a tint keeps its colour's hue instead of turning into another on a hued ground", () => {
    const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    const drifted = themes.flatMap((palette) =>
      (["light", "dark"] as const).flatMap((mode) =>
        ["--accent", "--attention", "--good", "--bad", "--warn"]
          .map((token) => ({
            palette,
            mode,
            token,
            by: Math.round(
              apart(hueOf(hexOf(token, mode, palette)), hueOf(hexOf(`${token}-soft`, mode, palette))),
            ),
          }))
          .filter(({ by }) => by > 25),
      ),
    );
    expect(drifted).toEqual([]);
  });

  test("a highlight is blue only in a theme whose own colour is blue", () => {
    const blue = (hex: string) => {
      const hue = hueOf(hex);
      return hue >= 195 && hue <= 250;
    };
    const strays = themes.flatMap((palette) =>
      (["light", "dark"] as const).flatMap((mode) =>
        blue(hexOf("--accent", mode, palette))
          ? []
          : ["--attention", "--info"]
              .filter((token) => blue(hexOf(token, mode, palette)))
              .map((token) => `${palette} ${mode} ${token} ${hexOf(token, mode, palette)}`),
      ),
    );
    expect(strays).toEqual([]);
  });

  test("each theme looks like itself: no two share an accent or an attention colour", () => {
    for (const token of ["--accent", "--attention", "--bg"]) {
      for (const mode of ["light", "dark"] as const) {
        const values = themes.map((palette) => hexOf(token, mode, palette));
        expect({ token, mode, distinct: new Set(values).size }).toEqual({
          token,
          mode,
          distinct: themes.length,
        });
      }
    }
  });
});

describe("the dashboard uses the language instead of going around it", () => {
  // Not anchored to line starts, so that a rule written on one line cannot slip past.
  const declarations = [
    ...stylesCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([a-z-]+):\s*([^;{}]+);/g),
  ].map((match) => ({
    property: match[1] ?? "",
    value: match[2] ?? "",
  }));

  test("no raw colors", () => {
    const raw = declarations.filter(({ value }) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(value));
    expect(raw).toEqual([]);
  });

  test.each([
    ["font-size", /^var\(--text-/],
    ["font-weight", /^var\(--weight-/],
    ["border-radius", /^var\(--radius-/],
    ["box-shadow", /^(var\(--shadow-|none)/],
    ["z-index", /^var\(--z-/],
  ])("%s always comes from a token", (property, allowed) => {
    const off = declarations.filter((item) => item.property === property && !allowed.test(item.value));
    expect(off).toEqual([]);
  });

  test("space always comes from the scale", () => {
    const off = declarations
      .filter(({ property }) => /^(padding|margin|gap)/.test(property))
      .filter(({ value }) => /\d+(px|rem|em)/.test(value));
    expect(off).toEqual([]);
  });

  test("nothing takes the focus ring away, apart from items whose own border or tint shows their focus", () => {
    const ringless = [
      ...stylesCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*outline:\s*none[^{}]*)\}/g),
    ].map((match) => (match[1] ?? "").trim());
    // A row's or an item's tint, a menu item's tint, and a box's border already show focus; the panel takes focus only
    // so the keys and a screen reader start in it, and its own edge shows where it is.
    expect(ringless.sort()).toEqual(
      [
        ".ui-field :is(input, textarea):focus",
        ".ui-menu-item:focus-visible",
        ".ui-menu-item:is(:hover, :focus-visible):not(:disabled)",
        ".ui-row:focus,\n.ui-focusable:focus",
        ".ui-search-input:focus",
        ".ui-side:focus",
      ].sort(),
    );
  });

  test("edges thicker than a hairline, and opacity, come from tokens", () => {
    const edges = declarations
      .filter(({ property }) => /^(border|outline)(-(top|right|bottom|left))?(-width)?$/.test(property))
      .filter(({ value }) => /\b([2-9]|\d{2,})px\b/.test(value));
    const opacity = declarations
      .filter(({ property }) => property === "opacity")
      .filter(({ value }) => !/^(var\(--opacity-|0$|1$)/.test(value));
    expect([...edges, ...opacity]).toEqual([]);
  });

  test("line height comes from the leading or the spacing scale", () => {
    const off = declarations
      .filter(({ property }) => property === "line-height")
      .filter(({ value }) => !/^(var\(--(leading|space)-|1$|normal$)/.test(value));
    expect(off).toEqual([]);
  });

  test("sizes come from tokens, apart from hairlines", () => {
    const sizes =
      /^(width|height|min-width|min-height|max-width|max-height|flex|flex-basis|grid-template-columns|contain-intrinsic-size)$/;
    const off = declarations
      .filter(({ property }) => sizes.test(property))
      .filter(({ value }) => /\d+(px|rem|em)\b/.test(value.replace(/\b1px\b/g, "")));
    expect(off).toEqual([]);
  });

  test("everything used is defined, and everything defined is used", () => {
    const used = new Set([...stylesCss.matchAll(/var\((--[a-z0-9-]+)/g)].flatMap((match) => match[1] ?? []));
    const internal = new Set(
      [...tokensCss.matchAll(/var\((--[a-z0-9-]+)/g)].flatMap((match) => match[1] ?? []),
    );
    const tones = new Set(["--tone", "--tone-soft", "--tone-mark"]);
    // A primitive's own measure, worked out from tokens where it is declared, such as a row's lead.
    const local = new Set(
      [...stylesCss.matchAll(/^\s*(--[a-z0-9-]+):/gm)].flatMap((match) => match[1] ?? []),
    );
    expect(
      [...used].filter((name) => !tokenNames.includes(name) && !tones.has(name) && !local.has(name)),
    ).toEqual([]);
    expect(
      tokenNames.filter((name) => !used.has(name) && !internal.has(name) && name !== "--space-unit"),
    ).toEqual([]);
  });

  test("components have no inline styles, apart from values only known at run time", () => {
    const offenders = filesUnder(COMPONENTS)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => readFileSync(file, "utf8").includes("style={{"));
    expect(offenders).toEqual([]);
  });
});

describe("a finger can use it", () => {
  const css = stylesCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const coarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const rulesFor = (selector: string) =>
    [...coarse.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => (match[1] ?? "").split(",").some((part) => part.trim() === selector))
      .map((match) => match[2] ?? "")
      .join("");
  const pixels = (token: string) => Number(new RegExp(`${token}: (\\d+)px;`).exec(rootBlock)?.[1] ?? 0);

  test("the touch target is the size fingers need", () => {
    expect(pixels("--touch-target")).toBeGreaterThanOrEqual(44);
  });

  test("text fields are large enough that iOS does not zoom the page on focus", () => {
    expect(pixels("--text-input-touch")).toBeGreaterThanOrEqual(16);
    expect(rulesFor(".ui-field input")).toContain("font-size: var(--text-input-touch)");
    expect(rulesFor(".ui-search-input")).toContain("font-size: var(--text-input-touch)");
  });

  test.each([".ui-button", ".ui-menu-item", ".ui-search-option"])("%s is tall enough to tap", (selector) => {
    expect(rulesFor(selector)).toContain("min-height: var(--touch-target)");
  });

  test.each([".ui-link::after", ".ui-ref::after", ".ui-lead::after"])(
    "%s, inside a line of words, reaches past its edges to a finger's size",
    (selector) => {
      expect(rulesFor(selector)).toContain("inset: calc(-1 * var(--space-5))");
    },
  );

  test("a choice's key number is drawn only where there are keys", () => {
    const outside = css.replace(/@media \(pointer: fine\) \{[\s\S]*?\n\}/g, "");
    expect(outside).not.toContain("[data-choice]::before");
    expect(css).toContain("[data-choice]::before");
  });

  test("reading text grows on touch screens", () => {
    const tokenCoarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(tokensCss)?.[1] ?? "";
    const touchSize = Number(/--text-md: (\d+)px;/.exec(tokenCoarse)?.[1] ?? 0);
    expect(touchSize).toBeGreaterThan(pixels("--text-md"));
  });
});

describe("the written language keeps up", () => {
  const foundations = readFileSync(join(import.meta.dir, "foundations.md"), "utf8");
  const components = readFileSync(join(import.meta.dir, "components.md"), "utf8");

  test("every token is explained", () => {
    expect(tokenNames.filter((name) => !foundations.includes(name))).toEqual([]);
  });

  test("every component is listed", () => {
    const names = filesUnder(COMPONENTS)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => basename(file, ".tsx"));
    expect(names.length).toBeGreaterThan(40);
    expect(names.filter((name) => !components.includes(`\`${name}\``))).toEqual([]);
  });
});
