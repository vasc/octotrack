import type { ReactNode } from "react";

/**
 * One quiet line of words that are not the item itself: a reason, a time, a count. The error form says a failure in
 * place, with the tracker's hint, when it gave one, as the line under it.
 */
export function Note({
  error = false,
  hint = null,
  children,
}: {
  error?: boolean;
  /** What the tracker says to do about it. */
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <p className="ui-note" data-error={error ? "true" : undefined} role={error ? "alert" : undefined}>
      {children}
      {hint === null || hint === undefined ? null : <span className="ui-note-hint">{hint}</span>}
    </p>
  );
}

/** Words in a monospace face: a path, a command, a ref. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="ui-code">{children}</code>;
}
