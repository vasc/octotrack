import type { HomeCounts } from "@octotrack/core/schemas";
import type { RefObject } from "react";
import type { Appearance, Mode, Palette } from "../../lib/appearance.ts";
import { navigate } from "../../lib/router.ts";
import { AppBar, BarLink, Count, Counts, Only } from "../ui/AppBar.tsx";
import { Button, IconButton } from "../ui/Button.tsx";
import { AppearanceMenu } from "./AppearanceMenu.tsx";
import { AtMenu } from "./AtMenu.tsx";
import { PagesMenu } from "./PagesMenu.tsx";

/** The header counts, each a link to the next such item in focus order, on Lines. Zeros are left out. */
export interface CountLink {
  key: keyof HomeCounts;
  label: string;
  count: number;
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
  /** A change of place is on its way. */
  atBusy?: boolean;
  /** Why the last change of place did not work. */
  atFailed?: string | undefined;
  /** The places could not load: said beside the bar's controls, with Try again. */
  onRetryPlaces?: (() => void) | undefined;
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/**
 * One bar on every page: the name, which opens Lines; the Log and Agents beside it, quieter; what waits on the
 * developer, urgent first; then where they are, New line, the theme, and on a phone the pages behind one icon.
 */
export function TopBar({
  path,
  counts,
  places,
  at,
  onAt,
  onNewLine,
  onKeys,
  atRef,
  atBusy = false,
  atFailed,
  onRetryPlaces,
  appearance,
  onPalette,
  onMode,
}: TopBarProps) {
  const ordered = [
    ...counts.filter((count) => count.key === "urgent"),
    ...counts.filter((count) => count.key !== "urgent"),
  ];
  return (
    <AppBar
      nav={
        <>
          <BarLink href="/" brand current={path === "/" || path === "/lines"} onGo={navigate}>
            Octotrack
          </BarLink>
          <BarLink href="/log" current={path === "/log"} onGo={navigate}>
            Log
          </BarLink>
          <BarLink href="/agents" current={path === "/agents"} onGo={navigate}>
            Agents
          </BarLink>
        </>
      }
      status={
        ordered.length === 0 ? null : (
          <Counts label="Waiting on you">
            {ordered.map((count) => (
              <Count
                key={count.key}
                n={count.count}
                label={count.label}
                urgent={count.key === "urgent"}
                href={`/?next=${count.key}`}
                onGo={navigate}
              />
            ))}
          </Counts>
        )
      }
      actions={
        <>
          {onRetryPlaces === undefined ? null : (
            <Button variant="quiet" onClick={onRetryPlaces}>
              Places did not load · Try again
            </Button>
          )}
          {places.length === 0 ? null : (
            <AtMenu
              places={places}
              at={at}
              onAt={onAt}
              busy={atBusy}
              failed={atFailed}
              {...(atRef === undefined ? {} : { buttonRef: atRef })}
            />
          )}
          <Button variant="primary" icon="plus" onClick={onNewLine}>
            New line
          </Button>
          <Only on="wide">
            <AppearanceMenu appearance={appearance} onPalette={onPalette} onMode={onMode} />
          </Only>
          {/* The keys are offered wherever there is a keyboard to press them, whatever the width. */}
          <Only on="keyboard">
            <IconButton icon="keyboard" label="Keyboard shortcuts" onClick={onKeys} />
          </Only>
          <Only on="phone">
            <PagesMenu
              path={path}
              onGo={navigate}
              appearance={appearance}
              onPalette={onPalette}
              onMode={onMode}
            />
          </Only>
        </>
      }
    />
  );
}
