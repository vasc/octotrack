import type { ReactNode } from "react";

/** A change that did not take, said in the warm tone where it was asked for, until the next try. */
export function NotDone({ children }: { children: ReactNode }) {
  return (
    <p className="ui-note" data-tone="warn" role="alert">
      {children}
    </p>
  );
}
