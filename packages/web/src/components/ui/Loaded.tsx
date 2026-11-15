import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "./states.tsx";

/** A part of the page that loaded once and could not refresh: what it shows stays, marked out of date. */
export function StaleNote({ error }: { error: Error }) {
  return (
    <p className="ui-note" role="status">
      Out of date: {error.message}
    </p>
  );
}

/**
 * What a part of the page shows while its data loads, or why it failed, until it has loaded once; then the part,
 * kept when a later refresh fails, marked out of date.
 */
export function Loaded({
  loaded,
  error,
  label,
  children,
}: {
  loaded: boolean;
  error: Error | null;
  label: string;
  children: ReactNode;
}) {
  if (!loaded) return error === null ? <LoadingState label={label} /> : <ErrorState error={error} />;
  return (
    <>
      {error === null ? null : <StaleNote error={error} />}
      {children}
    </>
  );
}
