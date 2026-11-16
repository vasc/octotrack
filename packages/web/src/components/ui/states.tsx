import type { ReactNode } from "react";
import { failureText } from "../../lib/failure.ts";
import { Button } from "./Button.tsx";

/** What is loading, in a few quiet words. */
export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <p className="ui-state" role="status">
      {label}…
    </p>
  );
}

/**
 * What went wrong, where it happened: what failed, why in words the page can stand behind, the tracker's hint under
 * it, and Try again when it can be tried again.
 */
export function ErrorState({
  error,
  title,
  onRetry,
}: {
  error: Error;
  /** What failed, such as "Could not load the plan.". */
  title?: string;
  onRetry?: () => void;
}) {
  const { text, hint } = failureText(error);
  return (
    <div className="ui-failure" role="alert">
      <p className="ui-failure-text">
        {title === undefined ? null : <b>{title}</b>} {text}
        {hint === null ? null : <span className="ui-failure-hint">{hint}</span>}
      </p>
      {onRetry === undefined ? null : <Button onClick={onRetry}>Try again</Button>}
    </div>
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
