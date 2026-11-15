import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "./states.tsx";

/** What a part of the page shows while its data loads, if it fails, and once it is there. */
export function Loaded({
  pending,
  error,
  label,
  children,
}: {
  pending: boolean;
  error: Error | null;
  /** What is loading, said while it does. */
  label: string;
  children: ReactNode;
}) {
  if (error !== null) return <ErrorState error={error} />;
  if (pending) return <LoadingState label={label} />;
  return <>{children}</>;
}
