import type { ReactNode } from "react";

/**
 * Everything a view holds, as one list: its name and where you are in it over the list, then a row each, the one you
 * are on opened in place among them.
 */
export function Queue({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-queue" aria-label={title}>
      <header className="ui-queue-head">
        <h1 className="ui-queue-title">{title}</h1>
        <p className="ui-queue-subtitle">{subtitle}</p>
      </header>
      <div className="ui-queue-list">{children}</div>
    </section>
  );
}
