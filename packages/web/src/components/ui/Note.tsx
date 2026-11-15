import type { ReactNode } from "react";

/** One quiet line of words that are not the item itself: a reason, a time, a count. */
export function Note({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p className="ui-note" data-error={error ? "true" : undefined} role={error ? "alert" : undefined}>
      {children}
    </p>
  );
}

/** A heading inside an item, in small grey words: Plan, Summary, Owner. */
export function Label({ children }: { children: ReactNode }) {
  return <h3 className="ui-label">{children}</h3>;
}

/** Words in a monospace face: a path, a command, a ref. */
export function Code({ children }: { children: ReactNode }) {
  return <code className="ui-code">{children}</code>;
}
