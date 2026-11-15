import type {
  HomeView,
  Line,
  LineCrew,
  LineHome,
  LineStart,
  RunnerStatus,
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
  if (crew.owner !== null) words.push(`owner ${crew.owner.name}, ${crew.owner.state}`);
  else if (crew.search !== null)
    words.push(stepIn ? "no owner: step in" : crew.search.step === 3 ? "no owner yet" : "finding an owner");
  if (crew.helpers.length > 0)
    words.push(`+${crew.helpers.length} helper${crew.helpers.length === 1 ? "" : "s"}`);
  if (crew.scoper !== null) words.push(`${crew.scoper.name} is scoping it`);
  return words;
}

/**
 * Why a working line has no owner, and what would fix it, or null while a session is being started for it. Says what
 * happened in the developer's terms: the setup file, watch mode, the last start's own words.
 */
export function stepInReason(line: Line, runner: RunnerStatus, start: LineStart | null): string | null {
  if (start !== null && (start.state === "starting" || start.state === "running")) return null;
  if (!runner.configured) {
    return `No agent took ${line.ref}, and none can be started for it: no start command is set on this machine. Add "start": ["claude", "-p", "You are {name}. Run: octo line take {line}"] to ~/.octotrack/agent-setup.json, then Try now.`;
  }
  if (runner.dryRun) {
    return `No agent took ${line.ref}. The runner is watching only, so it noted it would start one. Set dryRun to false in ~/.octotrack/agent-setup.json to let it.`;
  }
  if (start?.state === "failed" && start.took) {
    return `${start.name} took ${line.ref} and left soon after, with no way to wake it. Octotrack starts the next one less often each time: keep the session running, or have it register a wake address (octo agent register --wake).`;
  }
  if (start?.state === "failed") {
    const said = start.output?.trim().split("\n").at(-1);
    return `${start.name}, started for it, exited at once${said === undefined || said === "" ? "" : `: ${said}`}. Octotrack tries again by itself, less often each time.`;
  }
  if (start?.state === "never_took") return `${start.name} ran but never took ${line.ref}.`;
  return `No agent took ${line.ref}, and every session Octotrack may run is busy (at most ${runner.cap}).`;
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
