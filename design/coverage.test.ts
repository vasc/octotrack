import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every component the dashboard renders has a design: a section in a spec under design/screens, headed by the
 * component's path, that says what it shows while loading, when something fails, and when there is nothing to show.
 * A component without one, or a spec that leaves one of those out, fails here, so no state is left to whoever builds it.
 */
const ROOT = join(import.meta.dir, "..");
const COMPONENTS = join(ROOT, "packages/web/src/components");
const SPECS = join(import.meta.dir, "screens");
/** Each section answers these, even if the answer is that the state cannot happen and why. */
const REQUIRED = ["Loading:", "Error:", "Empty:"];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const components = filesUnder(COMPONENTS)
  .filter((path) => path.endsWith(".tsx") && !path.endsWith(".test.tsx"))
  .map((path) => relative(join(ROOT, "packages/web/src"), path))
  .sort();

/** Every `### <path>` section across the specs, with its text up to the next heading of the same or higher level. */
const sections = new Map<string, string>(
  (existsSync(SPECS) ? filesUnder(SPECS) : [])
    .filter((path) => path.endsWith(".md"))
    .flatMap((path) =>
      [
        ...readFileSync(path, "utf8").matchAll(
          /^### (components\/\S+\.tsx)\n([\s\S]*?)(?=^#{1,3} |$(?![\s\S]))/gm,
        ),
      ].map((match) => [match[1] ?? "", match[2] ?? ""] as const),
    ),
);

describe("every component has a design", () => {
  test("each component file has a section in design/screens", () => {
    expect(components.filter((path) => !sections.has(path))).toEqual([]);
  });

  test("each section says what shows while loading, on an error, and with nothing to show", () => {
    const missing = [...sections].flatMap(([path, text]) =>
      REQUIRED.filter((key) => !text.includes(key)).map((key) => `${path}: ${key}`),
    );
    expect(missing).toEqual([]);
  });

  test("no section names a component that no longer exists", () => {
    expect([...sections.keys()].filter((path) => !components.includes(path))).toEqual([]);
  });
});
