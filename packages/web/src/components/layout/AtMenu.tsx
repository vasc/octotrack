import type { RefObject } from "react";
import { Menu, MenuItem, MenuNote } from "../ui/Menu.tsx";
import { Code } from "../ui/Note.tsx";

/** I'm at: the developer's places to pick from, All places first, the one in force checked. g p reaches the button. */
export function AtMenu({
  places,
  at,
  onAt,
  buttonRef,
  busy = false,
}: {
  places: readonly string[];
  at: string | null;
  onAt(place: string | null): void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  /** The change is being sent. */
  busy?: boolean;
}) {
  const shown = at ?? "All places";
  return (
    <Menu
      label={`I'm at: ${shown}`}
      icon="pin"
      text={shown}
      menuLabel="I'm at"
      busy={busy ? "Changing…" : undefined}
      {...(buttonRef === undefined ? {} : { buttonRef })}
    >
      {(close) => (
        <>
          {[null, ...places].map((place) => (
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
          ))}
          <MenuNote>
            Places are added with <Code>octo place add</Code>
          </MenuNote>
        </>
      )}
    </Menu>
  );
}
