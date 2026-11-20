import type { ReactNode } from "react";

/**
 * The one item open on For you, on a sheet of its own lifted from the page: what it is, in large type, and what you do
 * about it. What it holds is drawn by the item's own components; the card gives them room and size.
 */
export function Card({ label, top, children }: { label: string; top?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-card-column" aria-label={label}>
      {top}
      <div className="ui-card">{children}</div>
    </section>
  );
}
