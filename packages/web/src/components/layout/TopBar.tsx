import type { HomeCounts } from "@octotrack/core/schemas";
import type { RefObject } from "react";
import { navigate } from "../../lib/router.ts";
import { Icon } from "../ui/Icon.tsx";
import type { Appearance, Mode, Palette } from "../../lib/appearance.ts";
import { AppearanceMenu } from "./AppearanceMenu.tsx";
import { AtMenu } from "./AtMenu.tsx";
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
  /** The I'm at button, which g p focuses. */
  atRef?: RefObject<HTMLButtonElement | null>;
  /** The theme and mode in use on this device. */
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/** Lines, Log and Agents, what waits on the developer, where they are, and New line. One bar on every page. */
export function TopBar({
  path,
  counts,
  places,
  at,
  onAt,
  onNewLine,
  onKeys,
  atRef,
  appearance,
  onPalette,
  onMode,
}: TopBarProps) {
  // Urgent stands apart, in front; the rest are one quiet group.
  const urgent = counts.find((count) => count.key === "urgent");
  const waiting = counts.filter((count) => count.key !== "urgent");
  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <span className="brand-name">Octotrack</span>
        <nav aria-label="Main" className="top-nav">
          <NavItem label="Lines" to="/" current={path === "/" || path === "/lines"} />
          <NavItem label="Log" to="/log" current={path === "/log"} />
          <NavItem label="Agents" to="/agents" current={path === "/agents"} />
        </nav>
        {counts.length === 0 ? null : (
          // One announced region for everything that waits, urgent first and apart, the rest one quiet group.
          <span className="top-waiting" role="status" aria-label="Waiting on you">
            {urgent === undefined ? null : <CountLinkView count={urgent} className="top-urgent" />}
            {waiting.length === 0 ? null : (
              <span className="top-counts">
                {waiting.map((count) => (
                  <CountLinkView key={count.key} count={count} className="top-count" />
                ))}
              </span>
            )}
          </span>
        )}
        <span className="top-actions">
          {places.length === 0 ? null : (
            <AtMenu
              places={places}
              at={at}
              onAt={onAt}
              {...(atRef === undefined ? {} : { buttonRef: atRef })}
            />
          )}
          {/* A plus alone on a phone, beside the theme, so what waits keeps the room; its name is always New line. */}
          <button
            type="button"
            className="btn top-new"
            aria-label="New line"
            title="New line"
            onClick={onNewLine}
          >
            <Icon name="plus" />
            <span className="top-new-word">
              New<span className="top-new-more"> line</span>
            </span>
          </button>
          <AppearanceMenu appearance={appearance} onPalette={onPalette} onMode={onMode} />
          <button
            type="button"
            className="btn btn-icon top-keys"
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
