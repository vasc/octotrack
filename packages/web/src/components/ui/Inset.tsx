import type { ReactNode } from "react";

/**
 * One fact set apart on a quiet ground, its name a small uppercase label over it, such as what finishes a line in its
 * peek (triage/T-Peek-Line). A region named for the fact.
 */
export function Inset({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="ui-inset" aria-label={label}>
      <span className="ui-inset-label">{label}</span>
      <div className="ui-inset-text">{children}</div>
    </section>
  );
}
