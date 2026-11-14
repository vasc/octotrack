import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { LineLog } from "./LineLog.tsx";
import { LogRow } from "./LogRow.tsx";
import { LooseSection } from "./LooseSection.tsx";

/**
 * Rule breaks, and work that reached a line after it was told to stop: always shown, at the top, whatever is filtered
 * or left out.
 */
const REFUSED: ReadonlySet<string> = new Set([
  "write.refused",
  "agent.would_stop",
  "agent.stopped",
  "pr.after_wind_down",
]);

/** Lines whose changes wait until asked for: up next and tabled are quiet. Every other line is shown. */
const QUIET: ReadonlySet<Line["state"]> = new Set(["up_next", "tabled"]);

/**
 * What the developer has not seen, as E-Feed draws it: rule breaks at the top, then line by line in their order, each
 * change a row, with checks and drift confirmations folded into one sentence. Up-next and tabled lines are left out
 * unless asked for.
 */
export function UnseenLog({
  events,
  lines,
  includeWaiting,
  onShowWaiting,
}: {
  events: readonly FeedEvent[];
  /** Every line, in the developer's order. */
  lines: readonly Line[];
  includeWaiting: boolean;
  onShowWaiting(): void;
}) {
  const refused = events.filter((event) => REFUSED.has(event.type));
  const shown = lines.filter((line) => includeWaiting || !QUIET.has(line.state));
  const waiting = lines.filter((line) => QUIET.has(line.state));
  const known = new Set(lines.map((line) => line.ref));
  const loose = events.filter((event) => event.line === null && !REFUSED.has(event.type));
  // A line this page does not list, such as one ended a while ago: its changes still show, never dropped.
  const elsewhere = events.filter(
    (event) => event.line !== null && !known.has(event.line) && !REFUSED.has(event.type),
  );
  const leftOut = includeWaiting
    ? 0
    : events.filter((event) => !REFUSED.has(event.type) && waiting.some((line) => line.ref === event.line))
        .length;
  return (
    <div className="log" role="feed" aria-label="Activity">
      {refused.length === 0 ? null : (
        <ul className="log-refused" aria-label="Rule breaks">
          {refused.map((event) => (
            <LogRow key={event.seq} event={event} />
          ))}
        </ul>
      )}
      {shown.map((line, index) => (
        <LineLog
          key={line.ref}
          line={line}
          number={index + 1}
          events={events.filter((event) => event.line === line.ref && !REFUSED.has(event.type))}
        />
      ))}
      <LooseSection title="On no line" events={loose} />
      <LooseSection title="Elsewhere" events={elsewhere} />
      {includeWaiting || waiting.length === 0 ? null : (
        <p className="log-foot">
          <span className="muted">
            Up next and tabled: {leftOut} change{leftOut === 1 ? "" : "s"} left out. Rule breaks show at the
            top.
          </span>{" "}
          <button type="button" className="btn" onClick={onShowWaiting}>
            Show them
          </button>
        </p>
      )}
    </div>
  );
}
