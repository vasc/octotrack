import type { FeedEvent } from "@octotrack/core/schemas";
import { filterTerm, timeLabel } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { RefLink, TextLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";

export interface FeedItemProps {
  event: FeedEvent;
  onFilter(term: string): void;
  now?: number;
}

/**
 * One event a search found: what it says, its ref if it does not say it, who did it, and when by the clock. Every ref
 * and name in it narrows the search.
 */
export function FeedItem({ event, onFilter, now = Date.now() }: FeedItemProps) {
  const narrow = (ref: string) => onFilter(filterTerm("ref", ref));
  return (
    <Row
      title={<RefText text={event.summary} onRef={narrow} />}
      facts={
        <Facts>
          {event.summary.includes(event.ref) ? null : <RefLink value={event.ref} onPick={narrow} />}
          <TextLink onClick={() => onFilter(filterTerm("actor", event.actor))}>{event.actor}</TextLink>
          <time dateTime={event.ts}>{timeLabel(event.ts, now)}</time>
        </Facts>
      }
    />
  );
}
