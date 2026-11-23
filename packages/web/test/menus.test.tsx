import { describe, expect, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { MoreMenu } from "../src/components/layout/MoreMenu.tsx";

const appearance = { palette: "paper", mode: "system" } as const;

/** More opened, then Appearance in it. */
function appearanceIn(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByRole("button", { name: "More" }));
  fireEvent.click(view.getByRole("menuitem", { name: /^Appearance/ }));
  return within(view.getByRole("menu", { name: "More" }));
}

describe("a menu's groups", () => {
  test("each group is a group named by its label, holding its own items", () => {
    const view = render(
      <MoreMenu
        onGo={() => {}}
        onKeys={() => {}}
        appearance={appearance}
        onPalette={() => {}}
        onMode={() => {}}
      />,
    );
    const menu = appearanceIn(view);
    const theme = within(menu.getByRole("group", { name: "Theme" }));
    expect(theme.getAllByRole("menuitemradio")).toHaveLength(8);
    const mode = within(menu.getByRole("group", { name: "Mode" }));
    expect(mode.getAllByRole("menuitemradio").map((item) => item.textContent?.replace("✓", ""))).toEqual([
      "As the system",
      "Light",
      "Dark",
    ]);
  });
});

describe("MoreMenu", () => {
  test("is behind the three dots, and its Appearance opens the themes and modes in its place", () => {
    const picked: string[] = [];
    const view = render(
      <MoreMenu
        onGo={() => {}}
        onKeys={() => {}}
        appearance={appearance}
        onPalette={(palette) => picked.push(palette)}
        onMode={() => {}}
      />,
    );
    expect(view.getByRole("button", { name: "More" }).querySelector("svg")?.getAttribute("data-icon")).toBe(
      "more",
    );
    fireEvent.click(appearanceIn(view).getByRole("menuitemradio", { name: "Nord" }));
    expect(picked).toEqual(["nord"]);
  });

  test("from the themes, Back returns to the rest of More", () => {
    const view = render(
      <MoreMenu
        onGo={() => {}}
        onKeys={() => {}}
        appearance={appearance}
        onPalette={() => {}}
        onMode={() => {}}
      />,
    );
    fireEvent.click(appearanceIn(view).getByRole("menuitem", { name: "More" }));
    view.getByRole("menuitem", { name: /^Log/ });
  });
});
