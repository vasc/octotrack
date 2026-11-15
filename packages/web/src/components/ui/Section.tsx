import type { ReactNode } from "react";

/**
 * A part of a page or a panel, named: its title and count in small words, and at the right end anything that acts on
 * all of it. What it holds is usually one List.
 */
export function Section({
  title,
  count,
  aside,
  children,
}: {
  title: string;
  /** How many, or a floor such as 50+. */
  count?: number | string | undefined;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ui-section" aria-label={title}>
      <div className="ui-section-head">
        <h2>
          {title}
          {count === undefined ? null : <span className="ui-section-count">{count}</span>}
        </h2>
        {aside === undefined ? null : <span className="ui-section-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
