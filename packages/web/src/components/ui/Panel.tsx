import { type ReactNode, type Ref, useRef } from "react";
import { useCloseOnOutsideTap } from "../../hooks/useCloseOnOutsideTap.ts";
import { IconButton } from "./Button.tsx";
import { Icon } from "./Icon.tsx";
import { Link } from "./Link.tsx";

/**
 * An item opened by its ref, a peek over the right of the page beside what you are doing; from the bottom on a phone.
 * Its head is one row: the way back to the peek it was opened from, where it sits, small and grey, its own page when it
 * has one, and Close, which always shuts it. Then its title and its sections.
 */
export function Panel({
  crumbs,
  title,
  onClose,
  back,
  page,
  head,
  children,
}: {
  crumbs?: ReactNode;
  title?: ReactNode;
  onClose(): void;
  /** Opened from another peek: what that one is, and the way back to it. */
  back?: { label: string; onBack(): void } | undefined;
  /** Its own page, for all of it: "Open the full page". */
  page?: { href: string; onGo(href: string): void } | undefined;
  /** What belongs with the title, such as what finishes it and its moves; a hairline then sets the sections apart. */
  head?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="ui-panel">
      <header className="ui-panel-head">
        {back === undefined ? null : (
          <button
            type="button"
            className="ui-panel-back"
            onClick={back.onBack}
            aria-label={`Back to ${back.label}`}
          >
            <Icon name="back" />
            {back.label}
          </button>
        )}
        <div className="ui-panel-crumbs">{crumbs}</div>
        {page === undefined ? null : (
          <Link href={page.href} onGo={page.onGo}>
            Open the full page
          </Link>
        )}
        <IconButton icon="cross" label="Close" onClick={onClose} />
      </header>
      {title === undefined ? null : <h1 className="ui-panel-title">{title}</h1>}
      {head === undefined ? null : <div className="ui-panel-top">{head}</div>}
      <div className="ui-panel-body" data-under-head={head === undefined ? undefined : "true"}>
        {children}
      </div>
    </div>
  );
}

/** Drawn over the page and part of what is open, not outside it: a sheet opened from the panel, a menu's list, the Undo bar. */
const PART_OF_IT = ".ui-sheet-layer, .ui-toasts, .ui-menu-list";

/**
 * Where a peek sits, over the right of the page under the bar, its full height whether it is loaded, loading or failed;
 * from the bottom on a phone. A press on
 * the page beside it closes it, as a tap outside closes a sheet; one that ends in no click, such as a finger scrolling
 * the page, does not. A press on another item in the list still opens that one.
 */
export function Side({
  label,
  ref,
  stacked = false,
  onClose,
  children,
}: {
  label: string;
  ref?: Ref<HTMLElement>;
  /** Opened from another peek, which shows as an edge to its left, the way back to it. */
  stacked?: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const own = useRef<HTMLElement | null>(null);
  useCloseOnOutsideTap(own, true, onClose, { except: PART_OF_IT, on: "click" });
  return (
    <aside
      className="ui-side"
      aria-label={label}
      data-stacked={stacked ? "true" : undefined}
      ref={(element) => {
        own.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref !== undefined && ref !== null) ref.current = element;
      }}
      tabIndex={-1}
    >
      {children}
    </aside>
  );
}
