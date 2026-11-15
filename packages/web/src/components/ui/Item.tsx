import type { ReactNode } from "react";
import type { Tone } from "./Row.tsx";

/**
 * Something opened in place, such as a question or a task: what it is after a dot, its title, then what it holds, a
 * step apart each. It has no box; the row it opens in is its sheet.
 */
export function Item({
  kind,
  tone = "needs",
  title,
  label,
  children,
}: {
  kind: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  /** Names it for a screen reader. */
  label?: string;
  children?: ReactNode;
}) {
  return (
    <article className="ui-item" aria-label={label}>
      <span className="ui-row-kind" data-tone={tone}>
        {kind}
      </span>
      {title === undefined ? null : <h3 className="ui-item-title">{title}</h3>}
      {children}
    </article>
  );
}
