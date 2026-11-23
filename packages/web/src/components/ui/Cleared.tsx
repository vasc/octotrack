import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/** Nothing left in a view: a check, what is true now, a few words on what comes, and where to go instead. */
export function Cleared({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="ui-cleared" aria-label={title}>
      <span className="ui-cleared-mark" aria-hidden="true">
        <Icon name="check" />
      </span>
      <h1 className="ui-cleared-title">{title}</h1>
      {children === undefined ? null : <div className="ui-cleared-text">{children}</div>}
      {actions === undefined ? null : <div className="ui-cleared-actions">{actions}</div>}
    </section>
  );
}
