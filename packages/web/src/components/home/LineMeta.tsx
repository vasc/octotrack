import type { LineCrew, LineHome } from "@octotrack/core/schemas";
import { crewText } from "../../lib/lines.ts";

/**
 * The facts beside a line's title, each after a dot: who is on it, whether it waits on you, its plan step. No owner
 * reads in red.
 */
export function LineMeta({ crew, details }: { crew?: LineCrew; details?: LineHome }) {
  const facts = [
    ...crewText(crew, details?.stepIn === true),
    // Waiting on you only when nothing else can move meanwhile; with something for you and work for the agents too,
    // they are on it.
    ...(details === undefined || details.forYou.length === 0
      ? []
      : [details.waitingOnYou ? "waiting on you" : "agents on it"]),
    ...(details === undefined || details.step === null
      ? []
      : [`step ${details.step.position} of ${details.step.of}, ${details.step.title}`]),
  ];
  if (facts.length === 0) return null;
  return (
    <span className="line-facts">
      {facts.map((fact) => (
        <span key={fact} data-tone={fact.startsWith("no owner") ? "bad" : undefined}>
          {" "}
          · {fact}
        </span>
      ))}
    </span>
  );
}
