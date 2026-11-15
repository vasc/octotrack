import type { ReactNode } from "react";

/** A place's buttons, in one row that wraps: the primary first, the rest words beside it. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="ui-actions">{children}</div>;
}
