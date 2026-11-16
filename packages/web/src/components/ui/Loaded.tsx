import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "./states.tsx";

/** A clock time, as a stale part says when it is from. */
function clock(at: number): string {
  const time = new Date(at);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

/** A part of the page that loaded once and could not refresh: what it shows stays, marked with the time it is from. */
export function StaleNote({ at }: { at?: number | undefined }) {
  return (
    <p className="ui-note" data-tone="warn" role="status">
      {at === undefined || at === 0
        ? "Could not refresh; this may be out of date."
        : `As of ${clock(at)}; could not refresh.`}
    </p>
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
      {error === null ? null : <StaleNote at={at} />}
      {children}
    </>
  );
}
