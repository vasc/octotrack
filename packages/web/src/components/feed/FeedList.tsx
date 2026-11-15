import type { FeedEvent } from "@octotrack/core/schemas";
import { dayLabel } from "../../lib/format.ts";
import { List } from "../ui/List.tsx";
import { Section } from "../ui/Section.tsx";
import { FeedItem } from "./FeedItem.tsx";

export interface FeedListProps {
  events: readonly FeedEvent[];
  onFilter(term: string): void;
}

/** The events, newest first, as consecutive runs of one day each. */
function byDay(events: readonly FeedEvent[]): { day: string; events: FeedEvent[] }[] {
  const days: { day: string; events: FeedEvent[] }[] = [];
  for (const event of events) {
    const day = dayLabel(event.ts);
    const last = days.at(-1);
    if (last !== undefined && last.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}

/** Events a search found, a section for each day. */
export function FeedList({ events, onFilter }: FeedListProps) {
  return (
    <>
      {byDay(events).map(({ day, events: ofDay }) => (
        <Section key={`${day}-${ofDay[0]?.seq}`} title={day}>
          <List>
            {ofDay.map((event) => (
              <FeedItem key={event.seq} event={event} onFilter={onFilter} />
            ))}
          </List>
        </Section>
      ))}
    </>
  );
}
