import type { ReactNode } from "react";

export function DesignSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="design-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** One component in one state, with a label saying which. */
export function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="design-example">
      <span className="design-label">{label}</span>
      {children}
    </div>
  );
}
