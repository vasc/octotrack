import type { Line } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";

/** Tabled and done lines, folded to one row that names them, until shown. */
export function FoldedSection({
  title,
  lines,
  note,
  children,
}: {
  title: string;
  lines: readonly Line[];
  note?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <section aria-label={title} className="folded">
      <div className="section-head">
        <h2 className="section-title">
          {title} · {lines.length}
          <small>
            {lines.map((line) => line.title).join(", ")}
            {note === undefined ? "" : ` · ${note}`}
          </small>
        </h2>
        <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? <div className="rows">{children}</div> : null}
    </section>
  );
}
