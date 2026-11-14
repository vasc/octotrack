import type { Line, LineCrew, LineStart, RunnerStatus } from "@octotrack/core/schemas";

/** How each state is named on screen. One place, so the inspector, the page and the CLI's words agree. */
export const LINE_STATE_LABEL: Readonly<Record<Line["state"], string>> = {
  proposed: "Proposed",
  working: "Working on",
  up_next: "Up next",
  tabled: "Tabled",
  done: "Done",
  dropped: "Dropped",
};

/** What the agent that proposed a line thinks should happen to it, in words. */
export function recommendationText(line: Line): string | null {
  if (line.recommendation === null) return null;
  return `${line.proposedBy ?? "An agent"} says ${line.recommendation.replace("_", " ")}`;
}

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
    return `No agent took ${line.ref}, and none can be started for it: no start command is set on this machine. Add one to ~/.octotrack/agent-setup.json.`;
  }
  if (runner.dryRun) {
    return `No agent took ${line.ref}. The runner is watching only, so it noted it would start one. Set dryRun to false in ~/.octotrack/agent-setup.json to let it.`;
  }
  if (start?.state === "failed") {
    const said = start.output?.trim().split("\n").at(-1);
    return `${start.name}, started for it, exited at once${said === undefined || said === "" ? "" : `: ${said}`}. Octotrack tries again by itself, less often each time.`;
  }
  if (start?.state === "never_took") return `${start.name} ran but never took ${line.ref}.`;
  return `No agent took ${line.ref}, and every session Octotrack may run is busy (at most ${runner.cap}).`;
}
