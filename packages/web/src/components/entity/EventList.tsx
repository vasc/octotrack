import type { FeedEvent } from "@octotrack/core/schemas";
import { LogRow } from "../feed/LogRow.tsx";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * What happened to an item, one row each in the order given, as the Log draws a change: the time leading, then what
 * happened with its refs openable, then who did it. Nothing when nothing has.
 */
export function EventList({ title, events }: { title: string; events: readonly FeedEvent[] }) {
  if (events.length === 0) return null;
  return (
    <Section title={title} count={events.length}>
      <List>
        {events.map((event) => (
          <LogRow key={event.seq} event={event} />
        ))}
      </List>
    </Section>
  );
}
