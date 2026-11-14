import type { Issue } from "@octotrack/core/schemas";

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
    if (task.outcome === "") return { result: "Done" };
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
