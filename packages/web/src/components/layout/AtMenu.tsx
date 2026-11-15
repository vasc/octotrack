import type { RefObject } from "react";
import { Menu, MenuItem } from "../ui/Menu.tsx";

/** I'm at: the developer's places to pick from, All places first, the one in force checked. g p reaches the button. */
export function AtMenu({
  places,
  at,
  onAt,
  buttonRef,
}: {
  places: readonly string[];
  at: string | null;
  onAt(place: string | null): void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const shown = at ?? "All places";
  return (
    <Menu
      label={`I'm at: ${shown}`}
      icon="pin"
      text={shown}
      menuLabel="I'm at"
      {...(buttonRef === undefined ? {} : { buttonRef })}
    >
      {(close) =>
        [null, ...places].map((place) => (
          <MenuItem
            key={place ?? ""}
            checked={place === at}
            onSelect={() => {
              close();
              if (place !== at) onAt(place);
            }}
          >
            {place ?? "All places"}
          </MenuItem>
        ))
      }
    </Menu>
  );
}
