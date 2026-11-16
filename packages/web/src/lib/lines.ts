import type {
  ForYou,
  HomeView,
  Line,
  LineCrew,
  LineHome,
  LinePlacement,
  StepInKind,
  UrgentReason,
} from "@octotrack/core/schemas";

/** How each state is named on screen. One place, so the inspector, the page and the CLI's words agree. */
export const LINE_STATE_LABEL: Readonly<Record<Line["state"], string>> = {
  proposed: "Proposed",
  working: "Working on",
  up_next: "Up next",
  tabled: "Tabled",
  done: "Done",
  dropped: "Dropped",
};

/**
 * Who is on a line, in a few words each: its owner and how it is, helpers, its scoper, or that nobody was found. Step
 * in is said only when the server asks the developer to (`stepIn`), the same rule the phone buzzes on.
 */
export function crewText(crew: LineCrew | undefined, stepIn = false): string[] {
  if (crew === undefined) return [];
  const words: string[] = [];
  if (crew.owner !== null) words.push(`${crew.owner.name}, ${crew.owner.state}`);
  else if (crew.search !== null)
    words.push(stepIn ? "no owner: step in" : crew.search.step === 3 ? "no owner yet" : "finding an owner");
  if (crew.helpers.length > 0)
    words.push(`+${crew.helpers.length} helper${crew.helpers.length === 1 ? "" : "s"}`);
  if (crew.scoper !== null) words.push(`${crew.scoper.name} is scoping it`);
  return words;
}

/** Why something is urgent, in the words the boards use: one of a fixed set. */
export const URGENT_REASON: Readonly<Record<UrgentReason, string>> = {
  broken: "something broken",
  time_boxed: "time-boxed",
  costs_money: "costs money",
};

/** Agents running on lines now, each counted once. */
export function runningAgents(home: HomeView): number {
  const names = new Set(
    Object.values(home.crews).flatMap((crew) =>
      [crew.owner, crew.scoper, ...crew.helpers].flatMap((agent) =>
        agent !== null && agent.state === "running" ? [agent.name] : [],
      ),
    ),
  );
  return names.size;
}

/** Where the next ask likely comes from: the first working line with a step still to do. */
export function nextAsk(home: HomeView): { title: string; step: string | null } | null {
  for (const line of home.working) {
    const step = home.lines[line.ref]?.step;
    if (step != null) return { title: line.title, step: step.title };
  }
  const first = home.working[0];
  return first === undefined ? null : { title: first.title, step: null };
}

/** Working lines nobody owns, the developer included: what spreading thin costs first. */
export function linesWithNoOwner(home: HomeView): number {
  return home.working.filter((line) => home.crews[line.ref]?.owner == null && line.ownedBy === null).length;
}

/** Working lines whose open work all waits on the developer. */
export function linesWaitingOnYou(home: HomeView): number {
  return home.working.filter((line) => home.lines[line.ref]?.waitingOnYou === true).length;
}

/** What the tabled lines hold, together, as a few words: questions and tasks that wait for their line to start. */
export function heldOnTabled(home: {
  tabled: readonly Pick<Line, "ref">[];
  lines: Readonly<Record<string, Pick<LineHome, "held">>>;
}): string | undefined {
  const held = home.tabled.reduce(
    (sum, line) => {
      const details = home.lines[line.ref];
      return details === undefined
        ? sum
        : { questions: sum.questions + details.held.questions, tasks: sum.tasks + details.held.tasks };
    },
    { questions: 0, tasks: 0 },
  );
  if (held.questions === 0 && held.tasks === 0) return undefined;
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return `${parts.join(" and ")} held`;
}

/** Every line home knows, in its sections' order: working, up next, proposed, tabled, done lately. */
export function homeLines(home: HomeView | undefined): readonly Line[] {
  return home === undefined
    ? []
    : [...home.working, ...home.upNext, ...home.proposed, ...home.tabled, ...home.doneLately];
}

/** What a line's facts need: whether all its open work waits on the developer, as the server decides (D14). */
type WaitingFacts = Readonly<Record<string, Pick<LineHome, "waitingOnYou">>>;

/** Whether all of a line waits on the developer, for the roster: no for no line, or one home does not list. */
export function lineWaitsOnYou(facts: WaitingFacts, ref: string | null): boolean {
  return ref !== null && facts[ref]?.waitingOnYou === true;
}

/** The lines a choice in the Undo bar can name, each with its title and whether all of it waits on the developer. */
export function undoLines(home: {
  working: readonly Pick<Line, "ref" | "title">[];
  upNext: readonly Pick<Line, "ref" | "title">[];
  lines: WaitingFacts;
}): Record<string, { title: string; waitsOnYou: boolean }> {
  return Object.fromEntries(
    [...home.working, ...home.upNext].map((line) => [
      line.ref,
      { title: line.title, waitsOnYou: home.lines[line.ref]?.waitingOnYou === true },
    ]),
  );
}

/** The lines the log groups by, in its order: what is moving first, then what waits (E-Feed). */
export function logLines(home: HomeView | undefined): readonly Line[] {
  return home === undefined
    ? []
    : [...home.working, ...home.proposed, ...home.doneLately, ...home.upNext, ...home.tabled];
}

/** What a proposer recommends, as words that end "Recommended: …". */
export const RECOMMENDED_MOVE: Readonly<Record<LinePlacement, string>> = {
  start: "start it",
  up_next: "up next",
  table: "table it",
  fold: "fold it into another line",
};

/** What a waiting line holds, in words: "1 question, 2 tasks, released when it starts", or null when it holds none. */
export function heldText(held: { questions: number; tasks: number }): string | null {
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${parts.join(", ")}, released when it starts`;
}

/** What waits on the developer on a line, counted by kind: what tabling it would hold. */
export function forYouCounts(items: readonly ForYou[]): { questions: number; tasks: number } {
  return {
    questions: items.filter((item) => item.kind === "question").length,
    tasks: items.filter((item) => item.kind === "task").length,
  };
}

/** A Tell in the Undo bar: whom it reaches, and what it says, or that it is a nudge. */
export function tellSummary(to: string, words: string): string {
  return words === "" ? `Nudging ${to}` : `Telling ${to}: ${words}`;
}

/** What can fix each reason a line needs the developer, beside Table it and I'll own it, which always fit. */
export const STEP_IN_ACTIONS: Readonly<Record<StepInKind, "retry" | "anyway" | "checkout" | null>> = {
  no_start_command: "retry",
  watch_only: null,
  failing: "retry",
  left: "retry",
  never_took: "retry",
  clone_failed: "checkout",
  no_repo: null,
  at_cap: "anyway",
};

/** Each reason in a few words, for Step in folded to a row, as E-States 4 writes it. */
export const STEP_IN_SHORT: Readonly<Record<StepInKind, string>> = {
  no_start_command: "nothing can start a session",
  watch_only: "the runner is only watching",
  failing: "a start keeps failing",
  left: "sessions keep leaving",
  never_took: "a session never took it",
  clone_failed: "its checkout could not be made",
  no_repo: "it names no repo",
  at_cap: "every session is busy",
};

/** What a folded section holds, by name: up to three, then how many more. */
export function foldedNames(names: readonly string[], shown = 3): string {
  const first = names.slice(0, shown).join(", ");
  return names.length <= shown ? first : `${first} and ${names.length - shown} more`;
}
