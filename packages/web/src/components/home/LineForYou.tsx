import type { ForYou } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { refOf } from "../../lib/focus.ts";
import { MoreForYou } from "./MoreForYou.tsx";

/**
 * What waits on the developer on a working line: the first thing open and the rest one row away, or, folded on a
 * phone, one row saying how many.
 */
export function LineForYou({
  forYou,
  folded,
  open,
  item,
  onFocus,
  onShowMore,
}: {
  forYou: readonly ForYou[];
  folded: boolean;
  /** The rest are shown, not one row away. */
  open: boolean;
  item(forYou: ForYou): ReactNode;
  onFocus(ref: string): void;
  onShowMore(): void;
}) {
  const [first, ...rest] = forYou;
  if (first === undefined) return null;
  if (folded)
    return (
      <div className="line-items">
        <button type="button" className="more-link" onClick={() => onFocus(refOf(first))}>
          {forYou.length} for you
        </button>
      </div>
    );
  return (
    <div className="line-items">
      {item(first)}
      {rest.length === 0 ? null : open ? rest.map(item) : <MoreForYou items={rest} onShow={onShowMore} />}
    </div>
  );
}
