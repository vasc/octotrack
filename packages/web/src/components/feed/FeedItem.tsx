import type { FeedEvent } from "@octotrack/core/schemas";
import { filterTerm, type Tone } from "../../lib/format.ts";
import { RefText } from "../ui/RefText.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export function eventTone(event: FeedEvent): Tone {
  switch (event.type) {
    case "decision.requested":
      return "attention";
    case "decision.resolved":
    case "pr.merged":
    case "drift.resolved":
      return "good";
    case "drift.opened":
      return "warn";
    case "pr.closed":
      return "bad";
    case "pr.checks_changed":
      return event.attrs.checks === "failing" ? "bad" : event.attrs.checks === "passing" ? "good" : "warn";
    case "pr.review_changed":
      return event.attrs.review === "changes_requested"
        ? "bad"
        : event.attrs.review === "approved"
          ? "good"
          : "warn";
    case "status.posted":
      if (event.attrs.level === "blocker") return "bad";
      if (event.attrs.level === "warning") return "warn";
      if (event.attrs.level === "done") return "good";
      return "info";
    case "issue.status_changed":
      if (event.attrs.status === "done") return "good";
      if (event.attrs.status === "blocked") return "bad";
      return "info";
    default:
      return "neutral";
  }
}

export interface FeedItemProps {
  event: FeedEvent;
  onFilter(term: string): void;
}

export function FeedItem({ event, onFilter }: FeedItemProps) {
  const needsPrefix = !event.summary.includes(event.ref);
  return (
    <article className="feed-row" data-event={event.type}>
      <span className="feed-mark" data-tone={eventTone(event)} title={event.type} />
      <div className="feed-text">
        {needsPrefix ? <RefText text={`${event.ref} `} /> : null}
        <RefText text={event.summary} />
      </div>
      <div className="feed-meta">
        {event.project === null ? null : (
          <button type="button" className="chip" onClick={() => onFilter(`project:${event.project}`)}>
            {event.project}
          </button>
        )}
        <button type="button" className="chip" onClick={() => onFilter(filterTerm("actor", event.actor))}>
          {event.actor}
        </button>
        <TimeAgo iso={event.ts} />
      </div>
    </article>
  );
}
