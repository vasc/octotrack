import type { LineCrew, LineHome } from "@octotrack/core/schemas";
import { crewText } from "../../lib/lines.ts";

/**
 * The facts beside a line's title, each after a dot: who is on it, whether it waits on you, held work being
 * re-confirmed, its plan step. No owner reads in red.
 */
export function LineMeta({
  crew,
  details,
  owned = false,
}: {
  crew?: LineCrew;
  details?: LineHome;
  /** The developer owns the line: its agents' questions and tasks wait, held, for an agent to take it back. */
  owned?: boolean;
}) {
  const heldForAgent = details === undefined || !owned ? 0 : details.held.questions + details.held.tasks;
  const facts = [
    ...crewText(crew, details?.stepIn === true),
    // Waiting on you only when nothing else can move meanwhile; with something for you and work for the agents too,
    // they are on it.
    ...(details === undefined || details.forYou.length === 0
      ? []
      : [details.waitingOnYou ? "waiting on you" : "agents on it"]),
    // Held work from before the line started, waiting for its agent to re-confirm or withdraw it.
    ...(details === undefined || details.reconfirming === 0 ? [] : [`${details.reconfirming} re-confirming`]),
    ...(heldForAgent === 0 ? [] : [`${heldForAgent} held for an agent`]),
    ...(details === undefined || details.step === null
      ? []
      : [`step ${details.step.position} of ${details.step.of}, ${details.step.title}`]),
  ];
  if (facts.length === 0) return null;
  return (
    // The dots between facts are drawn by the stylesheet, so a line of facts of its own, on a phone, starts clean.
    <span className="line-facts" data-separated="true">
      {facts.map((fact) => (
        <span key={fact} data-tone={fact.startsWith("no owner") ? "bad" : undefined}>
          {fact}
        </span>
      ))}
    </span>
  );
}
