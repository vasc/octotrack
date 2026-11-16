import type { ForYou } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { refOf, shortOf } from "../../lib/focus.ts";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { MoreForYou } from "./MoreForYou.tsx";

/**
 * What waits on the developer on a working line: the first thing and the rest one row away, or, folded on a phone, one
 * short row naming the first ("Question · Which South Tyrol base?") and how many more.
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
  if (folded) {
    const short = shortOf(first);
    return (
      <List>
        <Row
          kind={short.kind}
          title={short.title}
          {...(rest.length === 0 ? {} : { facts: `and ${rest.length} more` })}
          openLabel={`Open ${first.kind === "question" || first.kind === "task" ? refOf(first) : short.kind}`}
          onOpen={() => onFocus(refOf(first))}
        />
      </List>
    );
  }
  return (
    <List>
      {item(first)}
      {rest.length === 0 ? null : open ? rest.map(item) : <MoreForYou items={rest} onShow={onShowMore} />}
    </List>
  );
}
