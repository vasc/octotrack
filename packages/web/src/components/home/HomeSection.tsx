import type { ReactNode } from "react";

/** One section of home, named for screen readers, with its count and a note on what it means. */
export function HomeSection({
  title,
  count,
  note,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="home-section">
      <div className="section-head">
        <h2 className="section-title">
          {title}
          <small>
            {count}
            {note === undefined ? "" : ` · ${note}`}
          </small>
        </h2>
      </div>
      {children}
    </section>
  );
}
