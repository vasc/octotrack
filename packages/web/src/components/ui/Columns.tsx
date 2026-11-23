import type { ReactNode } from "react";

/** Parts side by side in two columns on a wide screen, one under another on a phone: the Keys sheet's groups. */
export function Columns({ children }: { children: ReactNode }) {
  return <div className="ui-columns">{children}</div>;
}
