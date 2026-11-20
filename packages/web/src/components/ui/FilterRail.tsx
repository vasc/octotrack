import type { ReactNode } from "react";
import { Only } from "./AppBar.tsx";
import { Menu, MenuItem } from "./Menu.tsx";

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
 * and a new tab work. On a phone, where there is no room beside the list, they are one menu named by the view you are
 * in, "To do 4".
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
  const shown = views.find((view) => view.key === current);
  return (
    <>
      <Only on="wide">
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
      </Only>
      <Only on="phone">
        <Menu
          label={shown === undefined ? label : `${label}: ${shown.label}, ${shown.count}`}
          text={shown === undefined ? label : `${shown.label} ${shown.count}`}
          menuLabel={label}
          align="start"
        >
          {(close) =>
            views.map((view) => (
              <MenuItem
                key={view.key}
                checked={view.key === current}
                trailing={view.count}
                onSelect={() => {
                  close();
                  onGo(view.href);
                }}
              >
                {view.label}
              </MenuItem>
            ))
          }
        </Menu>
      </Only>
    </>
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
