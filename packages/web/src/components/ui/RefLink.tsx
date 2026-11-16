import type { ReactNode } from "react";
import { openEntity } from "../../lib/router.ts";

/**
 * A ref anywhere on screen: small monospace words that open the item in the panel, or, where the page searches, narrow
 * the search to it.
 */
export function RefLink({ value, onPick }: { value: string; onPick?: (ref: string) => void }) {
  return (
    <button
      type="button"
      className="ui-ref"
      onClick={() => (onPick === undefined ? openEntity(value) : onPick(value))}
    >
      {value}
    </button>
  );
}

/** Words that open something, such as a line's title: ink, underlined in a light rule that darkens under the pointer. */
export function TextLink({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className="ui-link" onClick={onClick}>
      {children}
    </button>
  );
}
