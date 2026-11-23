import type { ReactNode } from "react";
import { Button } from "./Button.tsx";
import { ErrorState, LoadingState } from "./states.tsx";

/** A clock time, as a stale part says when it is from. */
function clock(at: number): string {
  const time = new Date(at);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

/**
 * A part of the page that loaded once and could not refresh: what it shows stays, marked with what could not refresh
 * and the time it is from, with Try again.
 */
export function StaleNote({
  at,
  what,
  onRetry,
}: {
  at?: number | undefined;
  /** What could not refresh, such as "the plan". */
  what?: string;
  onRetry?: () => void;
}) {
  const subject = what === undefined ? "" : ` ${what}`;
  return (
    <div className="ui-failure" data-tone="warn" role="status">
      <p className="ui-failure-text">
        {at === undefined || at === 0
          ? `Could not refresh${subject}; this may be out of date.`
          : `Could not refresh${subject}; as of ${clock(at)}.`}
      </p>
      {onRetry === undefined ? null : <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/**
 * What a part of the page shows while its data loads, as outlines, or what failed with Try again, until it has
 * loaded once; then the part, kept when a later refresh fails and marked with the time it is from.
 */
export function Loaded({
  loaded,
  error,
  what,
  onRetry,
  at,
  children,
}: {
  loaded: boolean;
  error: Error | null;
  /** What loads, as it ends "Loading …" and "Could not load …": "the plan". */
  what: string;
  onRetry(): void;
  /** When what is shown was last loaded, in milliseconds. */
  at?: number;
  children: ReactNode;
}) {
  if (!loaded) {
    return error === null ? (
      <LoadingState label={`Loading ${what}`} />
    ) : (
      <ErrorState title={`Could not load ${what}.`} error={error} onRetry={onRetry} />
    );
  }
  return (
    <>
      {error === null ? null : <StaleNote at={at} what={what} onRetry={onRetry} />}
      {children}
    </>
  );
}
