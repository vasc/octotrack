import type { LineCrew, LineHome } from "@octotrack/core/schemas";
import { crewText } from "../../lib/lines.ts";

/** One line of facts under a line's title: who is on it, whether it waits on you, and its plan step. */
export function LineMeta({ crew, details }: { crew?: LineCrew; details?: LineHome }) {
  const facts = [
    ...crewText(crew),
    ...(details !== undefined && details.forYou.length > 0 ? ["waiting on you"] : []),
    ...(details === undefined || details.step === null
      ? []
      : [`step ${details.step.position} of ${details.step.of}, ${details.step.title}`]),
  ];
  if (facts.length === 0) return null;
  return (
    <p className="home-meta">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
    </p>
  );
}
