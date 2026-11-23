import { type ReactNode, useState } from "react";
import { Icon } from "./Icon.tsx";

/**
 * A section folded to one row: its title and count, and after them a few of what it holds by name; opened, its rows.
 * Held open while one of its items has focus, so the page does not move around it.
 */
export function Fold({
  title,
  count,
  summary,
  held = false,
  children,
}: {
  title: string;
  count: number;
  /** A few of what it holds, by name, when there is room. */
  summary?: string | undefined;
  held?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open || held;
  return (
    <section className="ui-fold" aria-label={title} data-open={shown ? "true" : undefined}>
      <button
        type="button"
        className="ui-fold-head"
        aria-expanded={shown}
        // Held, it stays reachable by the keyboard, so its reason can be read; pressing it does nothing.
        aria-disabled={held ? true : undefined}
        onClick={() => {
          if (!held) setOpen(!open);
        }}
      >
        <span className="ui-fold-title">{title}</span>
        <span className="ui-section-count">{count}</span>
        {summary === undefined ? null : <span className="ui-fold-summary">{summary}</span>}
        {held ? (
          <span className="ui-fold-held">stays open while you are in it</span>
        ) : (
          <span className="ui-row-chevron" aria-hidden="true" data-open={shown ? "true" : undefined}>
            <Icon name="forward" />
          </span>
        )}
      </button>
      {shown ? children : null}
    </section>
  );
}
