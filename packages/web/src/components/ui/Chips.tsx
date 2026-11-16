import { useState } from "react";

export interface Chip {
  key: string;
  label: string;
  checked: boolean;
  onToggle(): void;
  /** Set apart from the rest, as "None: it's mine" is from the repos. */
  apart?: boolean;
}

/**
 * Choices that can each be on or off, as small pills that wrap, under their name: the first few shown and the rest a
 * press away, any set apart always shown last.
 */
export function Chips({
  label,
  chips,
  shown = 4,
}: {
  label: string;
  chips: readonly Chip[];
  shown?: number;
}) {
  // Showing every chip is a choice on this screen alone, so it is the component's own state.
  const [all, setAll] = useState(false);
  const plain = chips.filter((chip) => chip.apart !== true);
  const apart = chips.filter((chip) => chip.apart === true);
  // A chip already on stays shown, so folding never hides a choice made.
  const visible = all ? plain : plain.filter((chip, index) => index < shown || chip.checked);
  const hidden = plain.length - visible.length;
  return (
    <fieldset className="ui-chips">
      <legend className="ui-label">{label}</legend>
      <div className="ui-chips-row">
        {visible.map((chip) => (
          <ChipBox key={chip.key} chip={chip} />
        ))}
        {hidden === 0 ? null : (
          <button type="button" className="ui-link" onClick={() => setAll(true)}>
            + {hidden} more
          </button>
        )}
        {apart.map((chip) => (
          <ChipBox key={chip.key} chip={chip} />
        ))}
      </div>
    </fieldset>
  );
}

function ChipBox({ chip }: { chip: Chip }) {
  return (
    <label
      className="ui-chip"
      data-checked={chip.checked ? "true" : undefined}
      data-apart={chip.apart ? "true" : undefined}
    >
      <input type="checkbox" checked={chip.checked} onChange={chip.onToggle} />
      {chip.label}
    </label>
  );
}
