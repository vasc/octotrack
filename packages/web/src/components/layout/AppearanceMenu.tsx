import { type Appearance, MODES, type Mode, PALETTES, type Palette } from "../../lib/appearance.ts";
import { MenuGroup, MenuItem, Swatch } from "../ui/Menu.tsx";

interface AppearanceProps {
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/** The theme and the mode, Theme then Mode, the ones in force ticked: the eight themes each in its own colours. */
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
