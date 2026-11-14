import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { FeedItem } from "./FeedItem.tsx";

/** Changes that say little one by one: each line folds them to one sentence. */
const FOLDED: Readonly<Record<string, readonly [string, string]>> = {
  "pr.checks_changed": ["check change", "check changes"],
  "drift.resolved": ["drift confirmation", "drift confirmations"],
};

/** Shown even on a line left out, since a refused write is something the developer must see. */
const ALWAYS = "write.refused";

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

/**
 * What changed since the developer last looked, line by line in their order: each change a row, except checks and
 * drift confirmations, which fold into one sentence. Up-next and tabled lines are left out unless asked for; refused
 * writes never are.
 */
export function UnseenLog({
  events,
  lines,
  includeWaiting,
  onFilter,
}: {
  events: readonly FeedEvent[];
  /** Every line, in the developer's order. */
  lines: readonly Line[];
  includeWaiting: boolean;
  onFilter(term: string): void;
}) {
  const groups = lines.flatMap((line) => {
    const waiting = line.state !== "working";
    const own = events.filter(
      (event) => event.line === line.ref && (!waiting || includeWaiting || event.type === ALWAYS),
    );
    return own.length === 0 ? [] : [{ line, events: own }];
  });
  return (
    <div className="feed" role="feed" aria-label="Activity">
      {groups.map((group) => {
        const sentence = folded(group.events);
        return (
          <section key={group.line.ref} className="feed-group" aria-label={group.line.title}>
            <div className="feed-day">
              {group.line.title} <span className="muted">{group.line.ref}</span>
            </div>
            {group.events
              .filter((event) => FOLDED[event.type] === undefined)
              .map((event) => (
                <FeedItem key={event.seq} event={event} onFilter={onFilter} />
              ))}
            {sentence === null ? null : <p className="muted feed-folded">{sentence}</p>}
          </section>
        );
      })}
    </div>
  );
}
