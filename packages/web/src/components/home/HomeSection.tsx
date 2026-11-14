import type { ReactNode } from "react";

/**
 * One section of home, named for screen readers: its title and count, what it means, and anything that acts on the
 * whole section, such as Reorder. Working on is the main section and reads larger.
 */
export function HomeSection({
  title,
  count,
  note,
  actions,
  main = false,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  actions?: ReactNode;
  main?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="home-section">
      <div className="home-section-head">
        <h2 className="home-section-title" data-main={main}>
          {title} <span className="home-section-count">{count}</span>
        </h2>
        {note === undefined && actions === undefined ? null : (
          <span className="home-section-note">
            {note}
            {actions}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
