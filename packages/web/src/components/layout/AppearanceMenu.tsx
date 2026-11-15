import { useMenu } from "../../hooks/useMenu.ts";
import { type Appearance, MODES, type Mode, PALETTES, type Palette } from "../../lib/appearance.ts";
import { Icon } from "../ui/Icon.tsx";

/**
 * The theme and the mode, behind one quiet button in the bar: the eight themes, each previewed in its own colours, then
 * as the system, light or dark. The current ones are checked.
 */
export function AppearanceMenu({
  appearance,
  onPalette,
  onMode,
}: {
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}) {
  const menu = useMenu();
  const theme = PALETTES.find((palette) => palette.id === appearance.palette)?.name ?? "Paper";
  const mode = MODES.find((candidate) => candidate.id === appearance.mode)?.name ?? "As the system";
  return (
    <span className="menu-wrap" ref={menu.wrap}>
      <button
        ref={menu.button}
        type="button"
        className="btn btn-icon"
        aria-label={`Appearance: ${theme}, ${mode.toLowerCase()}`}
        title="Appearance"
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.toggle}
        onBlur={menu.leave}
      >
        <Icon name="palette" />
      </button>
      {menu.open ? (
        <div className="menu menu-end" role="menu" aria-label="Appearance" onKeyDown={menu.onMenuKey}>
          <span className="menu-label" aria-hidden="true">
            Theme
          </span>
          {PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              role="menuitemradio"
              aria-checked={palette.id === appearance.palette}
              className="menu-item"
              onBlur={menu.leave}
              // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on the theme in use
              autoFocus={palette.id === appearance.palette}
              onClick={() => {
                menu.close();
                onPalette(palette.id);
              }}
            >
              <span className="swatch" data-palette={palette.id} aria-hidden="true" />
              {palette.name}
            </button>
          ))}
          <span className="menu-label" aria-hidden="true">
            Mode
          </span>
          {MODES.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="menuitemradio"
              aria-checked={candidate.id === appearance.mode}
              className="menu-item"
              onBlur={menu.leave}
              onClick={() => {
                menu.close();
                onMode(candidate.id);
              }}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
