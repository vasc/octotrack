import { Fact, Facts } from "../ui/Facts.tsx";
import type { LineCrew, LineHome } from "@octotrack/core/schemas";
import { crewText } from "../../lib/lines.ts";

/**
 * The facts beside a line's title, each after a dot: who is on it, whether it waits on you, held work being
 * re-confirmed, its plan step. No owner reads in the warm tone.
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
    ...(owned ? ["yours"] : []),
    ...crewText(crew, details?.stepIn === true),
    // Waiting on you only when nothing else can move meanwhile; with something for you and work for the agents too,
    // they are on it.
    ...(details === undefined
      ? []
      : details.forYou.length === 0
        ? crew?.owner === null || crew?.owner === undefined
          ? []
          : ["agents on it"]
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
    <Facts>
      {facts.map((fact) =>
        fact.startsWith("no owner") ? (
          <Fact key={fact} tone="stuck">
            {fact}
          </Fact>
        ) : (
          fact
        ),
      )}
    </Facts>
  );
}
