import type { ReactNode } from "react";

export interface NextItem {
  key: string;
  /** Where it sits: its line and ref, small and grey. */
  where: string;
  title: string;
  /** One more fact, such as what is recommended. */
  note?: string | null;
  href: string;
}

/**
 * What comes after the open item: the next few, each a link that opens it in the middle, then a closing sentence about
 * what follows them.
 */
export function NextList({
  label,
  items,
  onOpen,
  after,
}: {
  label: string;
  items: readonly NextItem[];
  onOpen(key: string): void;
  after?: ReactNode;
}) {
  return (
    <aside className="ui-next" aria-label={label}>
      <span className="ui-next-label" aria-hidden="true">
        {label}
      </span>
      {items.map((item) => (
        <a
          key={item.key}
          className="ui-next-item"
          href={item.href}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            onOpen(item.key);
          }}
        >
          <span className="ui-next-where">{item.where}</span>
          <span className="ui-next-title">{item.title}</span>
          {item.note === undefined || item.note === null ? null : (
            <span className="ui-next-note">{item.note}</span>
          )}
        </a>
      ))}
      {after === undefined ? null : <p className="ui-next-after">{after}</p>}
    </aside>
  );
}
