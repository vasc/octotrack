import { Fact, Facts } from "../ui/Facts.tsx";
import { StepStrip } from "../ui/StepStrip.tsx";
import type { LineCrew, LineHome } from "@octotrack/core/schemas";
import { branchOfText, crewText } from "../../lib/lines.ts";

/** What the current step waits on: "waits on 2a and L-12, tabled", the tabled line said as such. */
function waitsText(refs: readonly string[], stalled: readonly string[]): string {
  return `waits on ${refs.map((ref) => (stalled.includes(ref) ? `${ref}, tabled` : ref)).join(" and ")}`;
}

/**
 * The facts under a line's title, each after a dot, led by how far along its plan is as a strip (triage/T-Lines): who
 * is on it, whether it waits on you, held work being re-confirmed, its plan step. No owner reads in the warm tone.
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
  const origin = branchOfText(details);
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
    ...(details === undefined || details.branchesOpen === 0
      ? []
      : [`${details.branchesOpen} branch${details.branchesOpen === 1 ? "" : "es"} open`]),
    ...(details === undefined || details.step === null || details.step.waitsOn.length === 0
      ? []
      : [waitsText(details.step.waitsOn, details.step.stalledOn)]),
    ...(origin === null ? [] : [origin]),
  ];
  if (facts.length === 0) return null;
  const step = details?.step ?? null;
  return (
    <>
      {step === null ? null : <StepStrip at={step.position} of={step.of} />}
      <Facts>
        {facts.map((fact) =>
          // No owner, or a step waiting on a tabled line: nothing moves until the developer acts.
          fact.startsWith("no owner") || fact.includes(", tabled") ? (
            <Fact key={fact} tone="stuck">
              {fact}
            </Fact>
          ) : (
            fact
          ),
        )}
      </Facts>
    </>
  );
}
