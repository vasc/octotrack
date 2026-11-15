import type { FeedEvent } from "@octotrack/core/schemas";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** What happened to an item, one row each in the order given, with who did it and when; nothing when nothing has. */
export function EventList({ title, events }: { title: string; events: readonly FeedEvent[] }) {
  if (events.length === 0) return null;
  return (
    <Section title={title} count={events.length}>
      <List>
        {events.map((event) => (
          <EventRow key={event.seq} event={event} />
        ))}
      </List>
    </Section>
  );
}

/** One thing that happened: what, with its refs openable, then who did it and when. */
export function EventRow({ event }: { event: FeedEvent }) {
  return (
    <Row
      quiet
      title={<RefText text={event.summary} />}
      facts={
        <Facts>
          {event.actor}
          <TimeAgo iso={event.ts} />
        </Facts>
      }
    />
  );
}
