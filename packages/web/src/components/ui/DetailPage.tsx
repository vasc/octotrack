import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  /** Where it leads; the last crumb, the page itself, has none. */
  href?: string;
}

/**
 * One thing on a page of its own: where it sits, as crumbs; its title, the sentence that says how it stands and its
 * facts, with its moves beside them; then what it holds, on a lifted sheet, and beside it what goes with it.
 */
export function DetailPage({
  crumbs,
  title,
  lead,
  facts,
  actions,
  aside,
  onGo,
  children,
}: {
  crumbs: readonly Crumb[];
  title: ReactNode;
  lead?: ReactNode;
  facts?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  onGo(href: string): void;
  children: ReactNode;
}) {
  return (
    <div className="ui-detail">
      <nav className="ui-detail-crumbs" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => (
          <span key={crumb.label} className="ui-detail-crumb">
            {index === 0 ? null : <span aria-hidden="true">/</span>}
            {crumb.href === undefined ? (
              crumb.label
            ) : (
              <a
                href={crumb.href}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) return;
                  event.preventDefault();
                  onGo(crumb.href ?? "/");
                }}
              >
                {crumb.label}
              </a>
            )}
          </span>
        ))}
      </nav>
      <div className="ui-detail-head">
        <div className="ui-detail-name">
          <h1 className="ui-detail-title">{title}</h1>
          {lead === undefined ? null : <div className="ui-detail-lead">{lead}</div>}
          {facts}
        </div>
        {actions === undefined ? null : <div className="ui-detail-actions">{actions}</div>}
      </div>
      <div className="ui-detail-body">
        <div className="ui-detail-main">{children}</div>
        {aside === undefined ? null : <div className="ui-detail-aside">{aside}</div>}
      </div>
    </div>
  );
}
