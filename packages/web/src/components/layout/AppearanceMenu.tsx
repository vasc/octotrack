import { type Appearance, MODES, type Mode, PALETTES, type Palette } from "../../lib/appearance.ts";
import { Menu, MenuGroup, MenuItem, Swatch } from "../ui/Menu.tsx";

interface AppearanceProps {
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/** The theme and the mode, behind one icon in the bar: the eight themes, each in its own colours, then the mode. */
export function AppearanceMenu({ appearance, onPalette, onMode }: AppearanceProps) {
  const theme = PALETTES.find((palette) => palette.id === appearance.palette)?.name ?? "Paper";
  const mode = MODES.find((candidate) => candidate.id === appearance.mode)?.name ?? "As the system";
  return (
    <Menu label={`Appearance: ${theme}, ${mode.toLowerCase()}`} icon="appearance" menuLabel="Appearance">
      {(close) => (
        <AppearanceChoices appearance={appearance} onPalette={onPalette} onMode={onMode} close={close} />
      )}
    </Menu>
  );
}

/** The choices themselves, Theme then Mode, the ones in force ticked: in their own menu, or inside Pages on a phone. */
export function AppearanceChoices({
  appearance,
  onPalette,
  onMode,
  close,
}: AppearanceProps & { close(): void }) {
  return (
    <>
      <MenuGroup label="Theme">
        {PALETTES.map((palette) => (
          <MenuItem
            key={palette.id}
            checked={palette.id === appearance.palette}
            onSelect={() => {
              close();
              onPalette(palette.id);
            }}
          >
            <Swatch palette={palette.id} />
            {palette.name}
          </MenuItem>
        ))}
      </MenuGroup>
      <MenuGroup label="Mode">
        {MODES.map((candidate) => (
          <MenuItem
            key={candidate.id}
            checked={candidate.id === appearance.mode}
            onSelect={() => {
              close();
              onMode(candidate.id);
            }}
          >
            {candidate.name}
          </MenuItem>
        ))}
      </MenuGroup>
    </>
  );
}
