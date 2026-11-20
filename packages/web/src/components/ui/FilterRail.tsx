import type { ReactNode } from "react";

export interface RailView {
  key: string;
  label: string;
  count: number;
  href: string;
  /** It counts something urgent: its number is drawn in the warning tone while above zero. */
  urgent?: boolean;
}

/**
 * The views of what waits on you, one under another with their counts, the one you are in marked: real links, so Back
 * and a new tab work.
 */
export function FilterRail({
  label,
  views,
  current,
  onGo,
}: {
  label: string;
  views: readonly RailView[];
  current: string;
  onGo(href: string): void;
}) {
  return (
    <nav className="ui-filter-rail" aria-label={label}>
      <span className="ui-filter-rail-label" aria-hidden="true">
        {label}
      </span>
      {views.map((view) => (
        <RailLink key={view.key} view={view} current={view.key === current} onGo={onGo}>
          {view.label}
        </RailLink>
      ))}
    </nav>
  );
}

function RailLink({
  view,
  current,
  onGo,
  children,
}: {
  view: RailView;
  current: boolean;
  onGo(href: string): void;
  children: ReactNode;
}) {
  return (
    <a
      className="ui-filter-rail-link"
      href={view.href}
      aria-label={`${view.label}, ${view.count}`}
      aria-current={current ? "page" : undefined}
      data-empty={view.count === 0 ? "true" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(view.href);
      }}
    >
      {children}
      <span
        className="ui-filter-rail-count"
        data-tone={view.urgent === true && view.count > 0 ? "warn" : undefined}
      >
        {view.count}
      </span>
    </a>
  );
}
