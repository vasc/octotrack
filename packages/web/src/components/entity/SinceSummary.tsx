import type { FeedEvent } from "@octotrack/core/schemas";
import { useState } from "react";
import { Link } from "../ui/Link.tsx";
import { navigate } from "../../lib/router.ts";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Section } from "../ui/Section.tsx";
import { EventRow } from "./EventList.tsx";

/**
 * Until its summary is rewritten, a line lists everything newer than the summary, one row each, with what the
 * developer has already seen folded to one row, so reading the line never means reading its history.
 */
export function SinceSummary({
  line,
  events,
  summaryAt,
  seenAt,
  more,
}: {
  line: string;
  /** The line's events, newest first. */
  events: readonly FeedEvent[];
  summaryAt: string | null;
  /** When the developer last looked at the line, as it was when the panel opened. */
  seenAt: string | null;
  /** Older changes exist past the page loaded: the count is a floor, and the rest are in the Log. */
  more: boolean;
}) {
  const newer = events.filter((event) => summaryAt === null || event.ts > summaryAt);
  const unseen = newer.filter((event) => seenAt === null || event.ts > seenAt);
  const seen = newer.filter((event) => !unseen.includes(event));
  // Showing what was already seen is a choice on this screen alone, so it is the component's own state.
  const [showSeen, setShowSeen] = useState(false);
  const log = `/log?q=${encodeURIComponent(`line:${line}`)}`;
  return (
    <Section
      title={summaryAt === null ? "What happened" : "New since the summary"}
      count={newer.length}
      aside={
        <Facts>
          {more ? "newest only" : null}
          <Link href={log} onGo={navigate}>
            This line in the log
          </Link>
        </Facts>
      }
    >
      {unseen.length === 0 ? (
        newer.length === 0 ? (
          <Note>Nothing has happened on it yet.</Note>
        ) : (
          <Note>Nothing you have not seen.</Note>
        )
      ) : (
        <List>
          {unseen.map((event) => (
            <EventRow key={event.seq} event={event} />
          ))}
        </List>
      )}
      {seen.length === 0 ? null : showSeen ? (
        <List>
          {seen.map((event) => (
            <EventRow key={event.seq} event={event} />
          ))}
        </List>
      ) : (
        <TextLink onClick={() => setShowSeen(true)}>Show the {seen.length} you have seen</TextLink>
      )}
    </Section>
  );
}
