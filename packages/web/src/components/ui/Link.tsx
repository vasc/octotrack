import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/**
 * A link that goes somewhere, in the words around it: to GitHub in a new tab, or to a page here that can be opened in
 * another with Cmd. Underlined in a light rule that darkens under the pointer; an arrow icon after it stays in the
 * app, an outward one leaves it, drawn for the eye only.
 */
export function Link({
  href,
  external = false,
  onGo,
  label,
  children,
}: {
  href: string;
  /** Somewhere outside the dashboard, opened in a new tab. */
  external?: boolean;
  /** A page here: followed in place, unless Cmd or Ctrl asks for a new tab. */
  onGo?: (href: string) => void;
  /** Its name for a screen reader, when the words alone do not say it. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <a
      className="ui-link"
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      onClick={(event) => {
        if (onGo === undefined || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onGo(href);
      }}
    >
      {children}
      <Icon name={external ? "external" : "arrow"} />
    </a>
  );
}
