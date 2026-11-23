import type { Appearance, Mode, Palette } from "../../lib/appearance.ts";
import { filterAt } from "../../lib/forYou.ts";
import { navigate } from "../../lib/router.ts";
import { AppBar, BarLink } from "../ui/AppBar.tsx";
import { Button } from "../ui/Button.tsx";
import { MoreMenu } from "./MoreMenu.tsx";

export interface TopBarProps {
  path: string;
  /** Everything waiting on the developer, or null while it loads. */
  waiting: number | null;
  /** How much is unseen in the Log, and how many agents are working, for More to say. */
  logNote?: string | null;
  agentsNote?: string | null;
  onNewLine(): void;
  onKeys(): void;
  appearance: Appearance;
  onPalette(palette: Palette): void;
  onMode(mode: Mode): void;
}

/**
 * One bar on every page, one row high: the name; Lines and For you, with how much waits on you; then New line and More,
 * which holds the Log, Agents, the appearance and the keys.
 */
export function TopBar({
  path,
  waiting,
  logNote = null,
  agentsNote = null,
  onNewLine,
  onKeys,
  appearance,
  onPalette,
  onMode,
}: TopBarProps) {
  const onLines = path === "/lines" || path.startsWith("/lines/");
  return (
    <AppBar
      nav={
        <>
          <BarLink href="/" brand current={false} onGo={navigate}>
            Octotrack
          </BarLink>
          <BarLink href="/lines" current={onLines} onGo={navigate}>
            Lines
          </BarLink>
          <BarLink
            href="/"
            current={filterAt(path) !== null}
            count={waiting ?? undefined}
            label={waiting === null ? "For you" : `For you, ${waiting} waiting`}
            onGo={navigate}
          >
            For you
          </BarLink>
        </>
      }
      actions={
        <>
          <Button variant="primary" icon="plus" onClick={onNewLine}>
            New line
          </Button>
          <MoreMenu
            logNote={logNote}
            agentsNote={agentsNote}
            onGo={navigate}
            onKeys={onKeys}
            appearance={appearance}
            onPalette={onPalette}
            onMode={onMode}
          />
        </>
      }
    />
  );
}
