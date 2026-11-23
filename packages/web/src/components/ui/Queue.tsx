import type { ReactNode } from "react";
import { Only } from "./AppBar.tsx";

/**
 * Everything a view holds, as one list: its name and where you are in it over the list, with the keys that work it
 * where there is a keyboard, then a row each, the one you are on opened in place among them.
 */
export function Queue({
  title,
  subtitle,
  hint,
  children,
}: {
  title: string;
  subtitle: string;
  /** The keys that work it, said beside where you are, where there is a keyboard to press them. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-queue" aria-label={title}>
      <div className="ui-queue-head">
        <h1 className="ui-queue-title">{title}</h1>
        <p className="ui-queue-subtitle">
          {subtitle}
          {hint === undefined ? null : <Only on="keyboard"> · {hint}</Only>}
        </p>
      </div>
      <div className="ui-queue-list">{children}</div>
    </section>
  );
}
