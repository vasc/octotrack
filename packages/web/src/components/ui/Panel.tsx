import type { ReactNode, Ref } from "react";

/**
 * An item opened by its ref, over the right of the page so the list keeps its place behind it; the whole screen on a
 * phone. Where it sits, small and grey, then its title, and Close; then its sections.
 */
export function Panel({
  crumbs,
  title,
  onClose,
  children,
}: {
  crumbs?: ReactNode;
  title?: ReactNode;
  onClose(): void;
  children?: ReactNode;
}) {
  return (
    <div className="ui-panel">
      <header className="ui-panel-head">
        <div className="ui-panel-crumbs">{crumbs}</div>
        <button type="button" className="ui-button" data-variant="quiet" aria-label="Close" onClick={onClose}>
          Close
        </button>
      </header>
      {title === undefined ? null : <h1 className="ui-panel-title">{title}</h1>}
      <div className="ui-panel-body">{children}</div>
    </div>
  );
}

/** Where an opened ref is drawn: over the right of the page, or the whole screen on a phone. */
export function Side({
  label,
  ref,
  children,
}: {
  label: string;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <aside className="ui-side" aria-label={label} ref={ref} tabIndex={-1}>
      {children}
    </aside>
  );
}
