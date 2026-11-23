import { Button } from "../ui/Button.tsx";
import { Callout } from "../ui/Callout.tsx";

/** A clock time, as the strip says when what is shown was true. */
function clock(at: number): string {
  const time = new Date(at);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

/**
 * What is true of the whole app, in a strip under the bar on every page, never a dialog: the live connection lost,
 * with when what is shown was true and Try now; a new version installed while the page was open, with Load it now.
 */
export function AppStrips({
  offlineSince,
  onReconnect,
  newVersion,
  onLoadNow,
}: {
  /** When the live connection was lost, while it is. */
  offlineSince: number | null;
  onReconnect(): void;
  /** A new build is installed and waits for the next switch to this tab. */
  newVersion: boolean;
  onLoadNow(): void;
}) {
  if (offlineSince === null && !newVersion) return null;
  return (
    <>
      {offlineSince === null ? null : (
        <Callout tone="warn" lead="Not live." actions={<Button onClick={onReconnect}>Try now</Button>}>
          Showing what was true at {clock(offlineSince)}; reconnecting. Answers you give wait until it is
          back.
        </Callout>
      )}
      {newVersion ? (
        <Callout
          lead="A new version of Octotrack is installed."
          actions={<Button onClick={onLoadNow}>Load it now</Button>}
        >
          It loads when you next switch to this tab; your drafts are kept.
        </Callout>
      ) : null}
    </>
  );
}
