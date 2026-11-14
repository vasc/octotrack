import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { timeLabel } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { RefText } from "../ui/RefText.tsx";

/** Changes that say little one by one: each line folds them to one sentence. */
const FOLDED: Readonly<Record<string, readonly [string, string]>> = {
  "pr.checks_changed": ["check change", "check changes"],
  "drift.resolved": ["drift confirmation", "drift confirmations"],
  "held.confirmed": ["re-confirmation", "re-confirmations"],
};

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

function folded(events: readonly FeedEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (FOLDED[event.type] !== undefined) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  const words = [...counts].flatMap(([type, count]) => {
    const names = FOLDED[type];
    return names === undefined ? [] : [`${count} ${count === 1 ? names[0] : names[1]}`];
  });
  return words.length === 0 ? null : words.join(", ");
}

function Row({ event }: { event: FeedEvent }) {
  return (
    <li className="log-row">
      <span className="muted">{timeLabel(event.ts)}</span>
      <span>
        <RefText text={event.summary} />
      </span>
    </li>
  );
}

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
            <Row key={event.seq} event={event} />
          ))}
        </ul>
      )}
      {shown.map((line, index) => {
        const own = events.filter((event) => event.line === line.ref && !REFUSED.has(event.type));
        const rows = own.filter((event) => FOLDED[event.type] === undefined);
        const sentence = folded(own);
        return (
          <article key={line.ref} className="log-line" aria-label={line.title}>
            <div className="log-line-head">
              <span className="line-num">{index + 1}</span>
              <span>
                <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
                  {line.title}
                </button>{" "}
                <span className="mono muted">{line.ref}</span>
                {own.length === 0 ? <span className="muted"> · nothing new</span> : null}
                {own.length > 0 && rows.length === 0 ? (
                  <span className="muted"> · {sentence}, all routine</span>
                ) : null}
                {rows.length === 0 || line.headline === null ? null : (
                  <span className="log-headline">
                    <Markdown text={line.headline} inline />
                  </span>
                )}
              </span>
              {rows.length === 0 ? null : <span className="log-unseen">{rows.length} unseen</span>}
            </div>
            {rows.length === 0 ? null : (
              <ul className="log-rows">
                {rows.map((event) => (
                  <Row key={event.seq} event={event} />
                ))}
                {sentence === null ? null : <li className="muted">Also routine: {sentence}.</li>}
              </ul>
            )}
          </article>
        );
      })}
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

/** Changes on no line, or on a line this page does not list: one group, so nothing not seen is dropped. */
function LooseSection({ title, events }: { title: string; events: readonly FeedEvent[] }) {
  const rows = events.filter((event) => FOLDED[event.type] === undefined);
  const sentence = folded(events);
  if (rows.length === 0) return null;
  return (
    <article className="log-line" aria-label={title}>
      <div className="log-line-head">
        <span className="line-num" aria-hidden="true">
          ·
        </span>
        <span>{title}</span>
        <span className="log-unseen">{rows.length} unseen</span>
      </div>
      <ul className="log-rows">
        {rows.map((event) => (
          <Row key={event.seq} event={event} />
        ))}
        {sentence === null ? null : <li className="muted">Also routine: {sentence}.</li>}
      </ul>
    </article>
  );
}
