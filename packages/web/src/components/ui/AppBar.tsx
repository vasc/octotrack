import type { ReactNode } from "react";
import { Mark } from "./Badge.tsx";

/** The one bar over every page: the name and the pages, then what waits, then the actions at its end. */
export function AppBar({ nav, status, actions }: { nav: ReactNode; status?: ReactNode; actions: ReactNode }) {
  return (
    <header className="ui-bar">
      <div className="ui-bar-inner">
        <nav aria-label="Main" className="ui-bar-nav">
          {nav}
        </nav>
        {status}
        <span className="ui-bar-actions">{actions}</span>
      </div>
    </header>
  );
}

/** A page in the bar: the name, which is the way home, or a quieter page beside it. */
export function BarLink({
  href,
  current,
  brand = false,
  count,
  label,
  onGo,
  children,
}: {
  href: string;
  current: boolean;
  brand?: boolean;
  /** How many wait there, after its name; left out at zero. */
  count?: number | undefined;
  /** Its name for a screen reader, when the count needs saying in words. */
  label?: string | undefined;
  onGo(href: string): void;
  children: ReactNode;
}) {
  return (
    <a
      className="ui-bar-link"
      data-brand={brand ? "true" : undefined}
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(href);
      }}
    >
      {children}
      {count === undefined || count === 0 ? null : <span className="ui-bar-count">{count}</span>}
    </a>
  );
}

/** What waits on the developer, announced as one region: each a number in ink and quieter words. */
export function Counts({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ui-counts" role="status" aria-label={label}>
      {children}
    </span>
  );
}

/** One count, opening the first item it counts; urgent goes first, marked with the triangle Status marks it with. */
export function Count({
  n,
  label,
  href,
  urgent = false,
  onGo,
}: {
  n: number;
  label: string;
  href: string;
  urgent?: boolean;
  onGo(href: string): void;
}) {
  return (
    <a
      className="ui-count"
      data-urgent={urgent ? "true" : undefined}
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(href);
      }}
    >
      {urgent ? <Mark tone="warn" icon="alert" /> : null}
      <b>{n}</b>
      {label}
    </a>
  );
}

/**
 * Shown only on a phone, or only on a wider screen, where the other has no room for it or no use; or only where there is
 * a fine pointer, so a keyboard is likely, as touch follows the input rather than the width.
 */
export function Only({ on, children }: { on: "phone" | "wide" | "keyboard"; children: ReactNode }) {
  return (
    <span className="ui-only" data-on={on}>
      {children}
    </span>
  );
}
