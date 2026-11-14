import type { Line } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";

/** Tabled or done lately: one tile naming its lines and what they hold, opened to its rows when shown. */
export function FoldedSection({
  title,
  lines,
  note,
  dashed = false,
  tone,
  children,
}: {
  title: string;
  lines: readonly Line[];
  note?: string | undefined;
  /** Tabled lines wait; their tile is drawn dashed. */
  dashed?: boolean;
  /** Proposals wait for your yes, in blue. */
  tone?: "info";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <section aria-label={title} className="tile" data-dashed={dashed} data-open={open} data-tone={tone}>
      <button type="button" className="tile-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <b>
            {title} · {lines.length}
          </b>{" "}
          <span className="tile-names">
            · {lines.map((line) => line.title).join(", ")}
            {note === undefined ? "" : ` · ${note}`}
          </span>
        </span>
        <span className="tile-show">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="rows">{children}</div> : null}
    </section>
  );
}
