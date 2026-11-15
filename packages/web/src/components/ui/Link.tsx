import type { ReactNode } from "react";

/**
 * A link that goes somewhere, in the words around it: to GitHub in a new tab, or to a page here that can be opened in
 * another with Cmd. Underlined only under the pointer.
 */
export function Link({
  href,
  external = false,
  onGo,
  children,
}: {
  href: string;
  /** Somewhere outside the dashboard, opened in a new tab. */
  external?: boolean;
  /** A page here: followed in place, unless Cmd or Ctrl asks for a new tab. */
  onGo?: (href: string) => void;
  children: ReactNode;
}) {
  return (
    <a
      className="ui-link"
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      onClick={(event) => {
        if (onGo === undefined || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(href);
      }}
    >
      {children}
    </a>
  );
}
