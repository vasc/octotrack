import type { FeedEvent } from "@octotrack/core/schemas";
import { Fragment } from "react";
import { dayLabel } from "../../lib/format.ts";
import { FeedItem } from "./FeedItem.tsx";

export interface FeedListProps {
  events: readonly FeedEvent[];
  onFilter(term: string): void;
}

/** Events with a heading wherever the day changes. */
export function FeedList({ events, onFilter }: FeedListProps) {
  return (
    <div className="feed" role="feed" aria-label="Activity">
      {events.map((event, index) => {
        const day = dayLabel(event.ts);
        const previous = events[index - 1];
        const showDay = previous === undefined || dayLabel(previous.ts) !== day;
        return (
          <Fragment key={event.seq}>
            {showDay ? <div className="feed-day">{day}</div> : null}
            <FeedItem event={event} onFilter={onFilter} />
          </Fragment>
        );
      })}
    </div>
  );
}
