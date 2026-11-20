import type { ReactNode } from "react";

/**
 * For you's page: the rail of views on the left, the one item open in the middle, what comes next on the right. While a
 * peek is open over the right of the page, the rail and Next fold away and the middle moves left, so it and the peek are
 * both whole.
 */
export function Triage({
  rail,
  next,
  folded = false,
  children,
}: {
  rail: ReactNode;
  next?: ReactNode;
  /** A peek is open over the right of the page. */
  folded?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ui-triage" data-folded={folded ? "true" : undefined}>
      <div className="ui-triage-rail">{rail}</div>
      <div className="ui-triage-main">{children}</div>
      <div className="ui-triage-next">{next}</div>
    </div>
  );
}
