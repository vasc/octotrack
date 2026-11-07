import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const tokensCss = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
const stylesCss = readFileSync(join(ROOT, "packages/web/src/styles.css"), "utf8");
const COMPONENTS = join(ROOT, "packages/web/src/components");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const rootBlock = /:root \{([\s\S]*?)\n\}/.exec(tokensCss)?.[1] ?? "";
const tokenNames = [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+):/gm)].flatMap((match) => match[1] ?? []);

function hexOf(name: string, theme: "light" | "dark"): string {
  const match = new RegExp(`${name}: light-dark\\((#[0-9a-f]{6}), (#[0-9a-f]{6})\\);`).exec(rootBlock);
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

const TEXT = 4.5;
const FOCUS_RING = 3;

/** Every pairing the components really use: [foreground, background, minimum]. */
const PAIRS: readonly (readonly [string, string, number])[] = [
  ...["--bg", "--surface", "--surface-2"].flatMap((ground) =>
    ["--ink", "--ink-2", "--ink-3"].map((ink) => [ink, ground, TEXT] as const),
  ),
  ["--bg", "--ink", TEXT], // The primary button.
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
  ["--attention", "--bg", FOCUS_RING],
  ["--attention", "--surface", FOCUS_RING],
];

describe("contrast", () => {
  test.each(PAIRS.flatMap((pair) => (["light", "dark"] as const).map((theme) => [...pair, theme] as const)))(
    "%s on %s reaches %d in %s",
    (foreground, background, minimum, theme) => {
      const ratio = contrast(hexOf(foreground, theme), hexOf(background, theme));
      expect(ratio).toBeGreaterThanOrEqual(minimum);
    },
  );
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

  test("everything used is defined, and everything defined is used", () => {
    const used = new Set([...stylesCss.matchAll(/var\((--[a-z0-9-]+)/g)].flatMap((match) => match[1] ?? []));
    const internal = new Set(
      [...tokensCss.matchAll(/var\((--[a-z0-9-]+)/g)].flatMap((match) => match[1] ?? []),
    );
    const tones = new Set(["--tone", "--tone-soft", "--tone-mark"]);
    expect([...used].filter((name) => !tokenNames.includes(name) && !tones.has(name))).toEqual([]);
    expect(
      tokenNames.filter((name) => !used.has(name) && !internal.has(name) && name !== "--space-unit"),
    ).toEqual([]);
  });

  test("components have no inline styles, apart from values only known at run time", () => {
    const allowed = ["Progress.tsx"];
    const offenders = filesUnder(COMPONENTS)
      .filter((file) => file.endsWith(".tsx") && !allowed.includes(basename(file)))
      .filter((file) => readFileSync(file, "utf8").includes("style={{"));
    expect(offenders).toEqual([]);
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
