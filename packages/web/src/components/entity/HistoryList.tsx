import type { FeedEvent } from "@octotrack/core/schemas";
import { RefText } from "../ui/RefText.tsx";
import { Section } from "../ui/Section.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export function HistoryList({ events }: { events: readonly FeedEvent[] }) {
  return (
    <Section title="History">
      {events.map((event) => (
        <div className="history-row" key={event.seq}>
          <RefText text={event.summary} /> <span className="muted">{event.actor}</span>{" "}
          <TimeAgo iso={event.ts} />
        </div>
      ))}
    </Section>
  );
}
