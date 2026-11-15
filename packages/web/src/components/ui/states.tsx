import type { ReactNode } from "react";

/** What is loading, in a few quiet words. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <p className="ui-state" role="status">
      {label}…
    </p>
  );
}

/** What went wrong, in its own words. */
export function ErrorState({ error }: { error: Error }) {
  return (
    <p className="ui-state" data-error="true" role="alert">
      {error.message}
    </p>
  );
}

/** Nothing here: a few words, and the command that would change that, if there is one. */
export function EmptyState({ children, command }: { children: ReactNode; command?: string }) {
  return (
    <div className="ui-state">
      <p>{children}</p>
      {command === undefined ? null : <pre className="ui-command">{command}</pre>}
    </div>
  );
}
