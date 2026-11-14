import type { FeedEvent } from "@octotrack/core/schemas";
import { FeedItem } from "../feed/FeedItem.tsx";
import { Section } from "../ui/Section.tsx";

/**
 * Until its summary is rewritten, a line lists everything newer than the summary, one row each, with what the
 * developer has already seen folded to one row, so reading the line never means reading its history.
 */
export function SinceSummary({
  events,
  summaryAt,
  seenAt,
  onFilter,
}: {
  /** The line's events, newest first. */
  events: readonly FeedEvent[];
  summaryAt: string | null;
  /** When the developer last looked at the line, as it was when the panel opened. */
  seenAt: string | null;
  onFilter(term: string): void;
}) {
  const newer = events.filter((event) => summaryAt === null || event.ts > summaryAt);
  if (newer.length === 0) return null;
  const unseen = newer.filter((event) => seenAt === null || event.ts > seenAt);
  const seen = newer.length - unseen.length;
  return (
    <Section title={summaryAt === null ? "So far" : "Since the summary"} note={String(newer.length)}>
      {unseen.map((event) => (
        <FeedItem key={event.seq} event={event} onFilter={onFilter} />
      ))}
      {seen === 0 ? null : <p className="muted feed-folded">{seen} you have seen</p>}
    </Section>
  );
}
