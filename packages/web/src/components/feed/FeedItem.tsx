import type { FeedEvent } from "@octotrack/core/schemas";
import { filterTerm } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { RefLink, TextLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export interface FeedItemProps {
  event: FeedEvent;
  onFilter(term: string): void;
}

/** One event a search found: what it says, its ref if it does not say it, its project and actor to narrow by, and when. */
export function FeedItem({ event, onFilter }: FeedItemProps) {
  const project = event.project;
  return (
    <Row
      title={<RefText text={event.summary} />}
      facts={
        <Facts>
          {event.summary.includes(event.ref) ? null : <RefLink value={event.ref} />}
          {project === null ? null : (
            <TextLink onClick={() => onFilter(`project:${project}`)}>{project}</TextLink>
          )}
          <TextLink onClick={() => onFilter(filterTerm("actor", event.actor))}>{event.actor}</TextLink>
          <TimeAgo iso={event.ts} />
        </Facts>
      }
    />
  );
}
