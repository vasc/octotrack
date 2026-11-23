import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dir, "../src");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : entry.name.endsWith(".tsx")
        ? [join(dir, entry.name)]
        : [],
  );
}

/*
 * Every look belongs to a primitive in components/ui, so a button, a row or a sheet looks the same on every screen. A
 * screen that styles itself, with a class or an inline style, is how the dashboard drifted into a different button on
 * every page; this keeps it from coming back.
 */
describe("screens are built from primitives", () => {
  const screens = files(join(SRC, "components")).filter(
    (file) => !file.includes(`${join("components", "ui")}/`),
  );

  test("no screen gives an element a class", () => {
    const styled = screens.filter((file) => /\bclassName=/.test(readFileSync(file, "utf8")));
    expect(styled.map((file) => relative(SRC, file))).toEqual([]);
  });

  test("no screen styles an element inline", () => {
    const styled = screens.filter((file) => /\bstyle=\{/.test(readFileSync(file, "utf8")));
    expect(styled.map((file) => relative(SRC, file))).toEqual([]);
  });

  test("ui.css styles only primitives", () => {
    const css = readFileSync(join(SRC, "ui.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const classes = [...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((match) => match[1]);
    expect(classes.filter((name) => !name?.startsWith("ui-"))).toEqual([]);
  });
});
