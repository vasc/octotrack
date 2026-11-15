import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "./states.tsx";

/** A part of the page that loaded once and could not refresh: what it shows stays, said to be out of date. */
export function StaleNote({ error }: { error: Error }) {
  return (
    <p className="muted" role="status">
      Could not refresh: {error.message}. This may be out of date.
    </p>
  );
}

/**
 * What a part of the page shows while its data loads, or why it failed, until it has loaded once; then the part,
 * kept when a later refresh fails, with a note saying so.
 */
export function Loaded({
  loaded,
  error,
  label,
  children,
}: {
  /** Its data has loaded at least once. */
  loaded: boolean;
  error: Error | null;
  /** What is loading, said while it does. */
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
