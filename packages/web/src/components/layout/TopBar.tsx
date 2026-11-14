import type { HomeCounts } from "@octotrack/core/schemas";
import type { Ref } from "react";
import { navigate } from "../../lib/router.ts";
import { Icon } from "../ui/Icon.tsx";
import { NavItem } from "./NavItem.tsx";

/** The header counts, each a link to the first such item in focus order. Zeros are left out. */
export interface CountLink {
  key: keyof HomeCounts;
  label: string;
  count: number;
  /** The item it opens, focused on Lines. */
  to: string | null;
}

export interface TopBarProps {
  path: string;
  counts: readonly CountLink[];
  places: readonly string[];
  /** The place the developer said they are at, or null for all places. */
  at: string | null;
  onAt(place: string | null): void;
  onNewLine(): void;
  onKeys(): void;
  /** The I'm at picker, which g p focuses. */
  atRef?: Ref<HTMLSelectElement>;
}

const ALL_PLACES = "";

const PAGE_NAMES: Readonly<Record<string, string>> = {
  "/": "Lines",
  "/lines": "Lines",
  "/log": "Log",
  "/agents": "Agents",
};

/** Lines, Log and Agents, what waits on the developer, where they are, and New line. One bar on every page. */
export function TopBar({ path, counts, places, at, onAt, onNewLine, onKeys, atRef }: TopBarProps) {
  // Urgent stands apart, in front; the rest are one quiet group.
  const urgent = counts.find((count) => count.key === "urgent");
  const waiting = counts.filter((count) => count.key !== "urgent");
  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <span className="brand-name">Octotrack</span>
        {/* On a phone the pages are tabs at the bottom, so the bar names the page instead of the product. */}
        <span className="top-page" aria-hidden="true">
          {PAGE_NAMES[path] ?? "Octotrack"}
        </span>
        <nav aria-label="Main" className="top-nav">
          <NavItem label="Lines" to="/" current={path === "/" || path === "/lines"} />
          <NavItem label="Log" to="/log" current={path === "/log"} />
          <NavItem label="Agents" to="/agents" current={path === "/agents"} />
        </nav>
        {urgent === undefined ? null : <CountLinkView count={urgent} className="top-urgent" />}
        {waiting.length === 0 ? null : (
          <span className="top-counts" role="status" aria-label="Waiting on you">
            {waiting.map((count) => (
              <CountLinkView key={count.key} count={count} className="top-count" />
            ))}
          </span>
        )}
        <span className="top-actions">
          {places.length === 0 ? null : (
            <span className="picker">
              <Icon name="pin" />
              <select
                ref={atRef}
                aria-label="I'm at"
                value={at ?? ALL_PLACES}
                onChange={(event) => onAt(event.target.value === ALL_PLACES ? null : event.target.value)}
              >
                <option value={ALL_PLACES}>All places</option>
                {places.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </span>
          )}
          <button type="button" className="btn top-new" onClick={onNewLine}>
            <Icon name="plus" />
            New line
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={onKeys}
          >
            <Icon name="keyboard" />
          </button>
        </span>
      </div>
    </header>
  );
}

/** One count: its number, then its words; it opens the first such item, focused. */
function CountLinkView({ count, className }: { count: CountLink; className: string }) {
  const to = count.to === null ? "/" : `/?focus=${encodeURIComponent(count.to)}`;
  return (
    <a
      className={className}
      data-count={count.key}
      href={to}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      <b className="top-count-n">{count.count}</b> <span>{count.label}</span>
    </a>
  );
}
