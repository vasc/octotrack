import type { ReactNode } from "react";

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <h1 className="page-title">{title}</h1>
      {children}
    </div>
  );
}
