import type { FeedEvent } from "@octotrack/core/schemas";

/** Changes that say little one by one, named singular and plural: the log folds them to one sentence. */
const ROUTINE: Readonly<Record<string, readonly [string, string]>> = {
  "pr.checks_changed": ["check change", "check changes"],
  "drift.resolved": ["drift confirmation", "drift confirmations"],
  "held.confirmed": ["re-confirmation", "re-confirmations"],
};

export function isRoutine(event: FeedEvent): boolean {
  return ROUTINE[event.type] !== undefined;
}

/** The routine changes among these, counted in a few words, such as "2 check changes, 1 re-confirmation". */
export function routineSentence(events: readonly FeedEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (isRoutine(event)) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  const words = [...counts].flatMap(([type, count]) => {
    const names = ROUTINE[type];
    return names === undefined ? [] : [`${count} ${count === 1 ? names[0] : names[1]}`];
  });
  return words.length === 0 ? null : words.join(", ");
}

/**
 * Whether there may be more changes newer than a line's summary than the page loaded: only when every change loaded is
 * newer than it and an older page remains. With no summary, every change counts.
 */
export function moreSinceSummary(
  events: readonly Pick<FeedEvent, "ts">[],
  summaryAt: string | null,
  nextBefore: number | null,
): boolean {
  if (nextBefore === null) return false;
  return summaryAt === null || events.every((event) => event.ts > summaryAt);
}

/** What a search that has matched nothing yet says while it looks further back. */
export function scanningText(scanned: number): string {
  return `Nothing in the last ${scanned.toLocaleString("en")} events yet; searching older ones…`;
}
