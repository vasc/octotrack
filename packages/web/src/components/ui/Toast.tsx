import type { ReactNode } from "react";

/** Choices waiting to take effect, over the foot of every page and any panel; announced politely. */
export function Toasts({ children }: { children: ReactNode }) {
  return (
    <div className="ui-toasts" role="status" aria-live="polite">
      {children}
    </div>
  );
}

/** One choice waiting, or one that failed: what it does, then what undoes or dismisses it. */
export function Toast({
  failed = false,
  actions,
  children,
}: {
  failed?: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ui-toast" data-failed={failed ? "true" : undefined}>
      <span className="ui-toast-text" role={failed ? "alert" : undefined}>
        {children}
      </span>
      <span className="ui-toast-actions">{actions}</span>
    </div>
  );
}
