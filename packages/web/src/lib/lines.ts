import type { Line, LineCrew } from "@octotrack/core/schemas";

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

/** Who is on a line, in a few words each: its owner and how it is, helpers, its scoper, or that nobody was found. */
export function crewText(crew: LineCrew | undefined): string[] {
  if (crew === undefined) return [];
  const words: string[] = [];
  if (crew.owner !== null) words.push(`owner ${crew.owner.name}, ${crew.owner.state}`);
  else if (crew.search !== null)
    words.push(crew.search.step === 3 ? "no owner: step in" : "finding an owner");
  if (crew.helpers.length > 0)
    words.push(`+${crew.helpers.length} helper${crew.helpers.length === 1 ? "" : "s"}`);
  if (crew.scoper !== null) words.push(`${crew.scoper.name} is scoping it`);
  return words;
}
