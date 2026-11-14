import type { ForYou, HomeView } from "@octotrack/core/schemas";

/** What an item is known by in focus order: a question's or task's ref; a proposal about a line, by its kind and line. */
export function refOf(item: ForYou): string {
  switch (item.kind) {
    case "question":
      return item.card.decision.ref;
    case "task":
      return item.task.ref;
    case "done":
      return `done:${item.line}`;
    case "done_when":
      return `done_when:${item.line}`;
  }
}

/** Where focus starts: an urgent question, else the first thing waiting on the first working line that has one. */
export function defaultFocus(home: HomeView): string | null {
  const urgent = home.urgent[0];
  if (urgent !== undefined) return urgent.decision.ref;
  for (const line of home.working) {
    const first = home.lines[line.ref]?.forYou[0];
    if (first !== undefined) return refOf(first);
  }
  return null;
}

/** Everything waiting on the developer, in the order j and k walk through it: urgent first, then line by line. */
export function orderedRefs(home: HomeView): string[] {
  return [
    ...home.urgent.map((card) => card.decision.ref),
    ...home.working.flatMap((line) => (home.lines[line.ref]?.forYou ?? []).map(refOf)),
  ];
}

/**
 * Where focus goes on home when what waits on the developer changes. Focus is what the number keys and Enter act on,
 * so it moves only when the developer moves it, or when the item it was on is gone: never because something arrived.
 *
 * `before` and `after` are everything waiting, in the order j and k walk it (urgent first, then line by line), before
 * and after the change. `fallback` is where focus starts when nothing has it yet.
 */
export function nextFocus(
  current: string | null,
  before: readonly string[],
  after: readonly string[],
  fallback: string | null,
): string | null {
  if (current !== null && after.includes(current)) return current;
  if (current !== null) {
    // Gone: the next item that is still there, which is the next on its line when it has one; else the one before.
    const at = before.indexOf(current);
    const later = before.slice(at + 1).find((ref) => after.includes(ref));
    if (at !== -1 && later !== undefined) return later;
    const earlier = before
      .slice(0, Math.max(at, 0))
      .reverse()
      .find((ref) => after.includes(ref));
    if (at !== -1 && earlier !== undefined) return earlier;
  }
  return fallback !== null && after.includes(fallback) ? fallback : (after[0] ?? null);
}
