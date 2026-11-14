import type { ReactNode } from "react";

/** A page's title, with its actions beside it, wrapping under it where the page is narrow. */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <h1 className="page-title">{title}</h1>
      {children === undefined ? null : <div className="page-actions">{children}</div>}
    </div>
  );
}
