import { type ReactNode, useState } from "react";
import { foldedNames } from "../../lib/lines.ts";

/**
 * A section folded to one tile: its name and count, and on a wide screen up to three of what it holds by name, opened to
 * its rows when shown. On a phone, as E-Phone draws it, the tile is the name and the count alone.
 */
export function FoldedSection({
  title,
  names,
  named = true,
  note,
  dashed = false,
  tone,
  children,
}: {
  title: string;
  /** What it holds, by name, in order. */
  names: readonly string[];
  /** Whether the tile names what it holds; a phone has no room for it. */
  named?: boolean;
  note?: string | undefined;
  /** Tabled lines wait; their tile is drawn dashed. */
  dashed?: boolean;
  /** Proposals wait for your yes, in blue. */
  tone?: "info";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (names.length === 0) return null;
  return (
    <section aria-label={title} className="tile" data-dashed={dashed} data-open={open} data-tone={tone}>
      <button type="button" className="tile-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <b>
            {title} · {names.length}
          </b>
          {named ? (
            <span className="tile-names">
              {" "}
              · {foldedNames(names)}
              {note === undefined ? "" : ` · ${note}`}
            </span>
          ) : null}
        </span>
        <span className="tile-show">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="rows">{children}</div> : null}
    </section>
  );
}
