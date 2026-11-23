import type { ReactNode } from "react";

/** How something is right now, in a sentence after a dot: in the good colour while it is live, grey when it is not. */
export function StatusLine({ live, children }: { live: boolean; children: ReactNode }) {
  return (
    <p className="ui-status-line">
      <span className="ui-status-dot" data-live={live ? "true" : undefined} aria-hidden="true" />
      {children}
    </p>
  );
}
