import { useState } from "react";
import type { Appearance, Mode, Palette } from "../../lib/appearance.ts";
import { PALETTES } from "../../lib/appearance.ts";
import { Only } from "../ui/AppBar.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Menu, MenuAction } from "../ui/Menu.tsx";
import { AppearanceChoices } from "./AppearanceMenu.tsx";

interface MoreMenuProps {
  onGo(to: string): void;
  onKeys(): void;
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/**
 * What is used less, behind one button at the end of the bar: the Log, Agents, the appearance, and the keys. Appearance
 * shows the themes and modes in the menu's place, with the way back above them.
 */
export function MoreMenu(props: MoreMenuProps) {
  return (
    <Menu label="More" icon="more" menuLabel="More">
      {(close) => <MoreChoices close={close} {...props} />}
    </Menu>
  );
}

function MoreChoices({
  close,
  onGo,
  onKeys,
  appearance,
  onPalette,
  onMode,
}: MoreMenuProps & { close(): void }) {
  // Which of the two the open menu shows is this menu's own; it starts over each time the menu opens.
  const [showing, setShowing] = useState<"more" | "appearance">("more");
  if (showing === "appearance") {
    return (
      <>
        <MenuAction onSelect={() => setShowing("more")}>
          <Icon name="back" />
          More
        </MenuAction>
        <AppearanceChoices appearance={appearance} onPalette={onPalette} onMode={onMode} close={close} />
      </>
    );
  }
  const theme = PALETTES.find((palette) => palette.id === appearance.palette)?.name ?? "Paper";
  const go = (to: string) => () => {
    close();
    onGo(to);
  };
  return (
    <>
      <MenuAction onSelect={go("/log")}>Log</MenuAction>
      <MenuAction onSelect={go("/agents")}>Agents</MenuAction>
      <MenuAction onSelect={() => setShowing("appearance")} trailing={theme}>
        Appearance
      </MenuAction>
      {/* The keys are offered wherever there is a keyboard to press them, whatever the width. */}
      <Only on="keyboard">
        <MenuAction
          onSelect={() => {
            close();
            onKeys();
          }}
          trailing="?"
        >
          Keyboard shortcuts
        </MenuAction>
      </Only>
    </>
  );
}
