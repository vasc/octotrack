import type { ForYou, HomeCounts, HomeView } from "@octotrack/core/schemas";

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

/**
 * Where focus starts: an urgent question; else, at a place, its first task; else the first thing waiting on the first
 * working line that has one.
 */
export function defaultFocus(home: HomeView): string | null {
  const urgent = home.urgent[0];
  if (urgent !== undefined) return urgent.decision.ref;
  const here = home.at?.tasks[0];
  if (here !== undefined) return here.ref;
  for (const line of home.working) {
    const first = home.lines[line.ref]?.forYou[0];
    if (first !== undefined) return refOf(first);
  }
  return null;
}

/** A working line's Step in item, in focus order. */
export function stepInRef(line: string): string {
  return `stepin:${line}`;
}

/**
 * Everything waiting on the developer, in the order j and k walk through it, top to bottom as drawn: urgent questions,
 * the working lines with their items (Step in first), then the proposals.
 */
export function orderedRefs(home: HomeView): string[] {
  return [
    ...home.urgent.map((card) => card.decision.ref),
    ...home.working.flatMap((line) => [
      ...(home.lines[line.ref]?.stepIn === true ? [stepInRef(line.ref)] : []),
      ...(home.lines[line.ref]?.forYou ?? []).map(refOf),
    ]),
    // I'm at a place: its tasks on lines up next, drawn under the working lines.
    ...(home.at?.tasks ?? [])
      .filter((task) => home.upNext.some((line) => line.ref === task.line))
      .map((task) => task.ref),
    ...home.proposed.map((line) => line.ref),
    ...home.noLine.map((card) => card.decision.ref),
  ];
}

/** The first item a header count stands for, in focus order: where clicking the count goes. */
export function firstOf(home: HomeView, count: keyof HomeCounts): string | null {
  const items = home.working.flatMap((line) => home.lines[line.ref]?.forYou ?? []);
  switch (count) {
    case "urgent":
      return (
        home.urgent[0]?.decision.ref ?? home.proposed.find((line) => line.urgentReason !== null)?.ref ?? null
      );
    case "toAnswer": {
      const question = items.find((item) => item.kind === "question");
      return question === undefined ? (home.noLine[0]?.decision.ref ?? null) : refOf(question);
    }
    case "toDo": {
      const task = items.find((item) => item.kind === "task");
      return task === undefined ? null : refOf(task);
    }
    case "toAccept": {
      const proposal = items.find((item) => item.kind === "done" || item.kind === "done_when");
      return proposal === undefined ? (home.proposed[0]?.ref ?? null) : refOf(proposal);
    }
    case "toStepIn": {
      const line = home.working.find((candidate) => home.lines[candidate.ref]?.stepIn === true);
      return line === undefined ? null : stepInRef(line.ref);
    }
  }
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

/** A line itself, in focus: reached with Shift J and K, so a line with nothing for the developer can be acted on. */
export function lineFocusRef(line: string): string {
  return `line:${line}`;
}

/** The lines Shift J and K walk: working on, then up next. */
export function lineRefs(home: HomeView): string[] {
  return [...home.working, ...home.upNext].map((line) => line.ref);
}

/** The line whatever has focus belongs to, which o, t and alt with the arrows act on. */
export function lineOf(home: HomeView, focus: string | null): string | null {
  if (focus === null) return null;
  for (const prefix of ["line:", "stepin:", "done:", "done_when:"]) {
    if (focus.startsWith(prefix)) return focus.slice(prefix.length);
  }
  if (home.proposed.some((line) => line.ref === focus)) return focus;
  const urgent = home.urgent.find((card) => card.decision.ref === focus);
  if (urgent !== undefined) return urgent.decision.line;
  for (const line of home.working) {
    if ((home.lines[line.ref]?.forYou ?? []).some((item) => refOf(item) === focus)) return line.ref;
  }
  return home.at?.tasks.find((task) => task.ref === focus)?.line ?? null;
}

/** Whether the focused item is a question, which takes its own number keys for its options. */
export function isQuestion(home: HomeView, focus: string | null): boolean {
  if (focus === null) return false;
  if ([...home.urgent, ...home.noLine].some((card) => card.decision.ref === focus)) return true;
  return home.working.some((line) =>
    (home.lines[line.ref]?.forYou ?? []).some((item) => item.kind === "question" && refOf(item) === focus),
  );
}

/**
 * Where j (forward) or k (back) goes from what has focus. From an item, the next or previous one. From a line itself,
 * reached with Shift J and K, the first thing for the developer on or after that line, or the last one before it, so j
 * never jumps back to the top. With nothing focused, the first or the last.
 */
export function stepFocus(
  home: HomeView,
  focus: string | null,
  order: readonly string[],
  forward: boolean,
): string | null {
  if (order.length === 0) return null;
  const at = focus === null ? -1 : order.indexOf(focus);
  if (at !== -1) return order[Math.min(Math.max(at + (forward ? 1 : -1), 0), order.length - 1)] ?? null;
  const line = focus?.startsWith("line:") === true ? focus.slice("line:".length) : null;
  if (line === null) return (forward ? order[0] : order.at(-1)) ?? null;
  const lines = lineRefs(home);
  const position = lines.indexOf(line);
  // Where each item is drawn: urgent questions above every line, then line by line, then what is on no line.
  const place = (ref: string): number => {
    if (home.urgent.some((card) => card.decision.ref === ref)) return -1;
    const owner = lineOf(home, ref);
    const index = owner === null ? -1 : lines.indexOf(owner);
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  return forward
    ? (order.find((ref) => place(ref) >= position) ?? order.at(-1) ?? null)
    : ([...order].reverse().find((ref) => place(ref) < position) ?? order[0] ?? null);
}

/**
 * Where Shift J (forward) or Shift K (back) goes: the next or previous line, working on then up next. From something on
 * no line, it goes by where that is drawn: an urgent question sits above every line, a proposal below them all.
 */
export function stepLineFocus(home: HomeView, focus: string | null, forward: boolean): string | null {
  const lines = lineRefs(home).map(lineFocusRef);
  if (lines.length === 0) return null;
  const current = lineOf(home, focus);
  const at = current === null ? -1 : lines.indexOf(lineFocusRef(current));
  if (at !== -1) return lines[Math.min(Math.max(at + (forward ? 1 : -1), 0), lines.length - 1)] ?? null;
  const above = focus === null || home.urgent.some((card) => card.decision.ref === focus);
  if (above) return lines[0] ?? null;
  return forward ? null : (lines.at(-1) ?? null);
}
