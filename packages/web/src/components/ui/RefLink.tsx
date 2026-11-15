import type { ReactNode } from "react";
import { openEntity } from "../../lib/router.ts";

/** A ref anywhere on screen: small monospace words that open the item in the panel. */
export function RefLink({ value }: { value: string }) {
  return (
    <button type="button" className="ui-ref" onClick={() => openEntity(value)}>
      {value}
    </button>
  );
}

/** Words that open something, such as a line's title: ink, underlined only under the pointer. */
export function TextLink({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className="ui-link" onClick={onClick}>
      {children}
    </button>
  );
}
