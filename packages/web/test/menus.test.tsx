import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, within } from "@testing-library/react";
import { AppearanceMenu } from "../src/components/layout/AppearanceMenu.tsx";
import { AtMenu } from "../src/components/layout/AtMenu.tsx";
import { PagesMenu } from "../src/components/layout/PagesMenu.tsx";

const appearance = { palette: "paper", mode: "system" } as const;

describe("a menu's groups", () => {
  test("each group is a group named by its label, holding its own items", () => {
    const view = render(<AppearanceMenu appearance={appearance} onPalette={() => {}} onMode={() => {}} />);
    fireEvent.click(view.getByRole("button", { name: "Appearance: Paper, as the system" }));
    const theme = within(view.getByRole("group", { name: "Theme" }));
    expect(theme.getAllByRole("menuitemradio")).toHaveLength(8);
    const mode = within(view.getByRole("group", { name: "Mode" }));
    expect(mode.getAllByRole("menuitemradio").map((item) => item.textContent?.replace("✓", ""))).toEqual([
      "As the system",
      "Light",
      "Dark",
    ]);
  });
});

describe("AtMenu", () => {
  test("ends with how places are added", () => {
    const view = render(<AtMenu places={["Home", "The bench"]} at={null} onAt={() => {}} />);
    fireEvent.click(view.getByRole("button", { name: "I'm at: All places" }));
    const menu = within(view.getByRole("menu", { name: "I'm at" }));
    menu.getByText("Places are added with");
    menu.getByText("octo place add");
  });
});

describe("PagesMenu", () => {
  test("is behind ☰, and on a phone holds Appearance, which opens the themes and modes in its place", () => {
    const onPalette = mock((_palette: string) => {});
    const view = render(
      <PagesMenu path="/" onGo={() => {}} appearance={appearance} onPalette={onPalette} onMode={() => {}} />,
    );
    const button = view.getByRole("button", { name: "Pages: Lines" });
    expect(button.querySelector("svg")?.getAttribute("data-icon")).toBe("pages");
    fireEvent.click(button);
    const pages = within(view.getByRole("menu", { name: "Pages" }));
    fireEvent.click(pages.getByRole("menuitem", { name: "Appearance" }));
    const menu = within(view.getByRole("menu", { name: "Pages" }));
    menu.getByRole("group", { name: "Theme" });
    fireEvent.click(menu.getByRole("menuitemradio", { name: "Nord" }));
    expect(onPalette).toHaveBeenCalledWith("nord");
  });

  test("from the themes, Back returns to the pages", () => {
    const view = render(
      <PagesMenu
        path="/log"
        onGo={() => {}}
        appearance={appearance}
        onPalette={() => {}}
        onMode={() => {}}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Pages: Log" }));
    fireEvent.click(view.getByRole("menuitem", { name: "Appearance" }));
    fireEvent.click(view.getByRole("menuitem", { name: "Pages" }));
    view.getByRole("menuitemradio", { name: "Log" });
  });
});
