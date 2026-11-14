import type { FeedEvent } from "@octotrack/core/schemas";
import { timeLabel } from "../../lib/format.ts";
import { RefText } from "../ui/RefText.tsx";

/** What happened to an item lately, newest first, one row each. */
export function ActivityList({ events }: { events: readonly FeedEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="panel-section" aria-label="Activity">
      <h2 className="panel-label">Activity · newest first</h2>
      <div className="since-list">
        {events.map((event) => (
          <span key={event.seq}>
            <span className="muted">{timeLabel(event.ts)}</span> <RefText text={event.summary} />
          </span>
        ))}
      </div>
    </section>
  );
}
