/** The choices a line offers in its panel and on home, each one press. */
export type LineChoice = "start" | "queue" | "done" | "drop" | "reject" | "own";

/**
 * What each choice about a line is doing while it waits, as the Undo bar says it: one table, so home and the line
 * panel word the same choice the same way.
 */
export const LINE_SAID: Readonly<Record<LineChoice | "table", (title: string) => string>> = {
  start: (title) => `Starting ${title}`,
  queue: (title) => `Moving ${title} to up next`,
  done: (title) => `Closing ${title} as done`,
  drop: (title) => `Dropping ${title}`,
  reject: (title) => `Turning down ${title}: not a line`,
  own: (title) => `Taking ${title} as yours`,
  table: (title) => `Tabling ${title}`,
};

/** Answering an agent's new done when for a line. */
export function doneWhenSaid(title: string, accept: boolean): string {
  return accept ? `Accepting the new done when for ${title}` : `Keeping ${title}'s done when`;
}
