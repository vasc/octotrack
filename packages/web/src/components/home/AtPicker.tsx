import { useState } from "react";

/** I'm at…: the developer's places as buttons, one press each; with one chosen, Leave. */
export function AtPicker({
  places,
  at,
  onAt,
}: {
  places: readonly string[];
  at: string | null;
  onAt(place: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  if (places.length === 0) return null;
  if (at !== null) {
    return (
      <button type="button" className="btn" aria-pressed="true" onClick={() => onAt(null)}>
        At {at}
      </button>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        I'm at…
      </button>
    );
  }
  return (
    <span className="decision-actions">
      {places.map((place) => (
        <button
          key={place}
          type="button"
          className="btn"
          onClick={() => {
            onAt(place);
            setOpen(false);
          }}
        >
          {place}
        </button>
      ))}
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}
