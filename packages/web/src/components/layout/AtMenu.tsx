import type { RefObject } from "react";
import { useMenu } from "../../hooks/useMenu.ts";
import { Icon } from "../ui/Icon.tsx";

/**
 * I'm at, as a button that opens the places to pick from, never a select an arrow key could change (patterns.md):
 * "All places" or one of the developer's places, the current one checked. g p reaches the button.
 */
export function AtMenu({
  places,
  at,
  onAt,
  buttonRef,
}: {
  places: readonly string[];
  at: string | null;
  onAt(place: string | null): void;
  /** The button, which g p focuses. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const menu = useMenu(buttonRef);
  const shown = at ?? "All places";
  const item = (place: string | null) => {
    const label = place ?? "All places";
    return (
      <button
        key={label}
        type="button"
        role="menuitemradio"
        aria-checked={place === at}
        className="menu-item"
        onBlur={menu.leave}
        // biome-ignore lint/a11y/noAutofocus: a menu opened takes the cursor on the place chosen now
        autoFocus={place === at}
        onClick={() => {
          menu.close();
          if (place !== at) onAt(place);
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <span className="picker-wrap" ref={menu.wrap}>
      <button
        ref={menu.button}
        type="button"
        className="btn picker"
        aria-label={`I'm at: ${shown}`}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={menu.toggle}
        onBlur={menu.leave}
      >
        <Icon name="pin" />
        {shown}
        <Icon name="chevron" />
      </button>
      {menu.open ? (
        <div className="menu" role="menu" aria-label="I'm at" onKeyDown={menu.onMenuKey}>
          {item(null)}
          {places.map(item)}
        </div>
      ) : null}
    </span>
  );
}
