import type { ReactNode } from "react";

/**
 * For you's page: the rail of views on the left and the list beside it. While a peek is open over the right of the
 * page, the rail folds away and the list moves left, so it and the peek are both whole.
 */
export function Triage({
  rail,
  folded = false,
  children,
}: {
  rail: ReactNode;
  /** A peek is open over the right of the page. */
  folded?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ui-triage" data-folded={folded ? "true" : undefined}>
      <div className="ui-triage-rail">{rail}</div>
      <div className="ui-triage-main">{children}</div>
    </div>
  );
}
