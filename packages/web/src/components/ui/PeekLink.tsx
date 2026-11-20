import type { ReactNode } from "react";

/**
 * Words naming something that opens in place, beside what you are doing: a line, a pull request. It is a real link to
 * its own page, which Cmd opens in a new tab; a plain click peeks at it instead. Tinted while its peek is open.
 */
export function PeekLink({
  href,
  open = false,
  onPeek,
  children,
}: {
  href: string;
  /** Its peek is the one open now. */
  open?: boolean;
  onPeek(): void;
  children: ReactNode;
}) {
  return (
    <a
      className="ui-peek-link"
      href={href}
      data-open={open ? "true" : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onPeek();
      }}
    >
      {children}
    </a>
  );
}
