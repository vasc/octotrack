import type { ReactNode } from "react";
import { navigate } from "../../lib/router.ts";

export function Section({
  title,
  note,
  linkTo,
  linkLabel,
  children,
}: {
  title: string;
  note?: string;
  linkTo?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">
          {title}
          {note === undefined ? null : <small>{note}</small>}
        </h2>
        {linkTo === undefined ? null : (
          <button type="button" className="chip section-link" onClick={() => navigate(linkTo)}>
            {linkLabel ?? "All"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
