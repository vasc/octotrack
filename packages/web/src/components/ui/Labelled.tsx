import type { ReactNode } from "react";

/** One fact on its own: a small grey label stacked over its sentence, such as "Done when" over what finishes a line. */
export function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-labelled">
      <span className="ui-labelled-label">{label}</span>
      <span className="ui-labelled-text">{children}</span>
    </div>
  );
}
