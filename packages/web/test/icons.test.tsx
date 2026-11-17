import { describe, expect, mock, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render } from "@testing-library/react";
import { StatusBadge } from "../src/components/ui/Badge.tsx";
import { Link } from "../src/components/ui/Link.tsx";
import { Panel } from "../src/components/ui/Panel.tsx";
import { markOf } from "../src/lib/format.ts";

/** Characters a font draws that the dashboard once used as icons. Each is an SVG icon now. */
const ICON_CHARACTERS = /[✓✗✕▲●◐○■→↗‹›☰⋯↵↑↓⌥]/u;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

function iconsIn(element: Element): string[] {
  return [...element.querySelectorAll("svg[data-icon]")].map((svg) => svg.getAttribute("data-icon") ?? "");
}

describe("icons", () => {
  test("no character from a font stands in for an icon anywhere in the dashboard", () => {
    const root = join(import.meta.dir, "../src");
    const offenders = sources(root).flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .flatMap((text, index) =>
          ICON_CHARACTERS.test(text) ? [`${path.slice(root.length + 1)}:${index + 1}: ${text.trim()}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });

  test("a state's mark is an icon, in its tone, never read out", () => {
    const view = render(<StatusBadge value="failing" />);
    const tag = view.getByText("failing");
    expect(iconsIn(tag)).toEqual(["cross"]);
    expect(tag.querySelector("[aria-hidden='true'] svg")).not.toBeNull();
    expect(["merged", "pending", "in_progress", "open", "backlog", "cancelled"].map(markOf)).toEqual([
      "check",
      "alert",
      "half",
      "dot",
      "ring",
      "dash",
    ]);
  });

  test("Back is an icon before its words, and the words alone name it", () => {
    const onBack = mock(() => {});
    const view = render(<Panel title="L-1" onClose={() => {}} back={{ label: "L-57", onBack }} />);
    const back = view.getByRole("button", { name: "Back to L-57" });
    expect(iconsIn(back)).toEqual(["back"]);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("a link says where it goes with an arrow icon, not a character", () => {
    const view = render(
      <>
        <Link href="/log?q=L-3">This line in the log</Link>
        <Link href="https://github.com/vasc/stack/pull/4" external>
          vasc/stack#4
        </Link>
      </>,
    );
    const inside = view.getByRole("link", { name: "This line in the log" });
    const outside = view.getByRole("link", { name: "vasc/stack#4" });
    expect(iconsIn(inside)).toEqual(["arrow"]);
    expect(iconsIn(outside)).toEqual(["external"]);
    expect(inside.textContent).toBe("This line in the log");
  });
});
