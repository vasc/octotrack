import type { FeedEvent, Issue } from "@octotrack/core/schemas";

/** What Done sends for a task: its words, or each named outcome with any note beside them. */
export interface TaskOutcome {
  result?: string;
  values?: Readonly<Record<string, string>>;
}

/**
 * What Done would send for this task given what is typed, or null while it is not ready: every named outcome filled,
 * or, with none named, some words. A task of the developer's own has nothing to send back, so Done is enough.
 */
export function taskOutcome(
  task: Issue,
  values: Readonly<Record<string, string>>,
  note: string,
): TaskOutcome | null {
  const words = note.trim();
  if (task.fields.length === 0) {
    // Nothing was asked back: Done needs no words, and any words typed go along as a note.
    if (task.outcome === "") return words === "" ? {} : { result: words };
    return words === "" ? null : { result: words };
  }
  const filled = Object.fromEntries(task.fields.map((name) => [name, (values[name] ?? "").trim()]));
  if (Object.values(filled).some((value) => value === "")) return null;
  return words === "" ? { values: filled } : { values: filled, result: words };
}

/** How many of a task's named outcomes have something in them. */
export function filledCount(task: Issue, values: Readonly<Record<string, string>>): number {
  return task.fields.filter((name) => (values[name] ?? "").trim() !== "").length;
}

/** Done in the Undo bar, worded as it happens: what is sent and to which line, or that a task of one's own is done. */
export function doneSummary(
  task: Pick<Issue, "ref" | "title" | "outcome">,
  outcome: TaskOutcome,
  line: string | null,
): string {
  if (task.outcome === "") return `Marking "${task.title}" done`;
  const sent =
    outcome.values === undefined
      ? (outcome.result ?? "")
      : Object.entries(outcome.values)
          .map(([name, value]) => `${name} ${value}`)
          .join(", ");
  return line === null ? `Sending "${sent}" for ${task.ref}` : `Sending "${sent}" to ${line}`;
}

/** Can't do it in the Undo bar: it closes the task as not done, and why. */
export function cantSummary(task: Pick<Issue, "ref">, why: string): string {
  return `Closing ${task.ref} as not done: ${why}`;
}

/** A task is an issue for the developer with something to report: "dev" is the name the developer acts under. */
export function isTask(issue: Pick<Issue, "assignee" | "outcome">): boolean {
  return issue.assignee === "dev" && issue.outcome !== null;
}

/** How a task closed and who closed it, from its history (newest first): done, could not be done, or withdrawn. */
export function howClosed(
  history: readonly Pick<FeedEvent, "type" | "actor">[],
): { how: "done" | "cant" | "withdrawn"; by: string } | null {
  const HOW = { "task.done": "done", "task.cant": "cant", "task.withdrawn": "withdrawn" } as const;
  for (const item of history) {
    if (item.type === "task.done" || item.type === "task.cant" || item.type === "task.withdrawn") {
      return { how: HOW[item.type], by: item.actor };
    }
  }
  return null;
}
