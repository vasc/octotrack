import { useState } from "react";
import type { Appearance, Mode, Palette } from "../../lib/appearance.ts";
import { Menu, MenuAction, MenuItem } from "../ui/Menu.tsx";
import { AppearanceChoices } from "./AppearanceMenu.tsx";

const PAGES = [
  { to: "/", name: "Lines" },
  { to: "/log", name: "Log" },
  { to: "/agents", name: "Agents" },
] as const;

/** Which page a path is: Lines unless it is the Log or Agents. */
function pageOf(path: string): string {
  return PAGES.find((page) => page.to !== "/" && path === page.to)?.to ?? "/";
}

interface PagesMenuProps {
  path: string;
  onGo(to: string): void;
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/**
 * On a phone, where the bar has no room for their names: the pages behind "☰", the one you are on checked, then
 * Appearance, which shows the themes and modes in the menu's place.
 */
export function PagesMenu({ path, ...rest }: PagesMenuProps) {
  const current = pageOf(path);
  const name = PAGES.find((page) => page.to === current)?.name ?? "Lines";
  return (
    <Menu label={`Pages: ${name}`} icon="pages" menuLabel="Pages">
      {(close) => <PagesChoices current={current} close={close} {...rest} />}
    </Menu>
  );
}

/** What the open menu shows: the pages, or the appearance choices with a way back. */
function PagesChoices({
  current,
  close,
  onGo,
  appearance,
  onPalette,
  onMode,
}: Omit<PagesMenuProps, "path"> & { current: string; close(): void }) {
  // Which of the two the open menu shows is this menu's own; it starts over each time the menu opens.
  const [showing, setShowing] = useState<"pages" | "appearance">("pages");
  if (showing === "appearance") {
    return (
      <>
        <MenuAction onSelect={() => setShowing("pages")}>‹ Pages</MenuAction>
        <AppearanceChoices appearance={appearance} onPalette={onPalette} onMode={onMode} close={close} />
      </>
    );
  }
  return (
    <>
      {PAGES.map((page) => (
        <MenuItem
          key={page.to}
          checked={page.to === current}
          onSelect={() => {
            close();
            onGo(page.to);
          }}
        >
          {page.name}
        </MenuItem>
      ))}
      <MenuAction onSelect={() => setShowing("appearance")}>Appearance</MenuAction>
    </>
  );
}
