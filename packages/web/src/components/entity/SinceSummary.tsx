import type { FeedEvent } from "@octotrack/core/schemas";
import { timeLabel } from "../../lib/format.ts";
import { navigate } from "../../lib/router.ts";
import { RefText } from "../ui/RefText.tsx";

/**
 * Until its summary is rewritten, a line lists everything newer than the summary, one row each, with what the
 * developer has already seen folded to one row, so reading the line never means reading its history.
 */
export function SinceSummary({
  line,
  events,
  summaryAt,
  seenAt,
}: {
  line: string;
  /** The line's events, newest first. */
  events: readonly FeedEvent[];
  summaryAt: string | null;
  /** When the developer last looked at the line, as it was when the panel opened. */
  seenAt: string | null;
}) {
  const newer = events.filter((event) => summaryAt === null || event.ts > summaryAt);
  const unseen = newer.filter((event) => seenAt === null || event.ts > seenAt);
  const seen = newer.length - unseen.length;
  return (
    <section className="panel-section" aria-label="New since the summary">
      <h2 className="panel-label">
        {summaryAt === null ? "So far" : "New since the summary"} · {newer.length}
      </h2>
      <div className="since-list">
        {unseen.map((event) => (
          <span key={event.seq} className="since-row">
            <span className="muted">{timeLabel(event.ts)}</span> <RefText text={event.summary} />
          </span>
        ))}
        {seen === 0 ? null : <span className="muted">{seen} you have seen</span>}
        <span className="muted">Everything newer than the summary; any you have seen fold to one row.</span>
        <a
          href={`/log?q=line:${line}`}
          className="panel-link"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            navigate(`/log?q=${encodeURIComponent(`line:${line}`)}`);
          }}
        >
          This line in the log
        </a>
      </div>
    </section>
  );
}
