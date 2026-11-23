import { CLEARED_QUERY } from "../../hooks/useClearedToday.ts";
import { type Filter, forYouPath } from "../../lib/forYou.ts";
import { navigate } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { Cleared } from "../ui/Cleared.tsx";
import { Link } from "../ui/Link.tsx";

const NOTHING: Readonly<Record<Filter, string>> = {
  all: "Nothing waits on you",
  urgent: "Nothing urgent",
  toAnswer: "Nothing to answer",
  toDo: "Nothing to do",
  toAccept: "Nothing to accept",
  toStepIn: "Nothing to step in on",
};

/**
 * A view with nothing in it: what is true now; with everything clear, who is at work and where the next ask likely
 * comes from; else the next view that holds something.
 */
export function ForYouEmpty({
  filter,
  working,
  cleared = null,
  nextAsk,
  then,
}: {
  filter: Filter;
  /** The agents running now, each with the line it is on. */
  working: readonly { agent: string; line: string }[];
  /** What the developer cleared today, when known. */
  cleared?: { questions: number; tasks: number; lines: number } | null;
  /** Where the next ask likely comes from. */
  nextAsk: { title: string; step: string | null } | null;
  /** The next view that holds something, with its name and count. */
  then: { filter: Filter; label: string; count: number } | null;
}) {
  const agents = workingText(working);
  const today = cleared === null ? null : clearedText(cleared);
  return (
    <Cleared
      title={NOTHING[filter]}
      actions={
        then === null ? (
          <>
            <Link href="/lines" onGo={navigate}>
              Go to Lines
            </Link>
            <Button variant="quiet" onClick={() => navigate("/log")}>
              See what happened in the Log
            </Button>
          </>
        ) : (
          <Link href={forYouPath(then.filter)} onGo={navigate} label={`${then.label}, ${then.count} waiting`}>
            {then.label}, {then.count} waiting
          </Link>
        )
      }
    >
      {filter === "all" ? (
        <>
          <p>
            {agents}
            {nextAsk === null
              ? ""
              : ` The next ask will likely come from ${nextAsk.title}${nextAsk.step === null ? "" : `, at ${nextAsk.step}`}.`}
          </p>
          {today === null ? null : (
            <p>
              {today}{" "}
              <Link href={`/log?q=${encodeURIComponent(CLEARED_QUERY)}`} onGo={navigate}>
                See them
              </Link>
            </p>
          )}
        </>
      ) : null}
    </Cleared>
  );
}

/** Who is working on what, in a sentence: "panel-widgets is working on Speaker enclosure." */
function workingText(working: readonly { agent: string; line: string }[]): string {
  const [first, second] = working;
  if (first === undefined) return "No agent is working.";
  if (second === undefined) return `${first.agent} is working on ${first.line}.`;
  const named = working.slice(0, 2).map((one) => `${one.agent} on ${one.line}`);
  const rest = working.length - named.length;
  return `${working.length} agents are working: ${named.join(", ")}${rest === 0 ? "" : `, and ${rest} more`}.`;
}

/** What was cleared today, in a sentence, or nothing when nothing was: "You cleared today: 3 questions answered." */
function clearedText(cleared: { questions: number; tasks: number; lines: number }): string | null {
  const parts = [
    cleared.questions === 0
      ? null
      : `${cleared.questions} question${cleared.questions === 1 ? "" : "s"} answered`,
    cleared.tasks === 0 ? null : `${cleared.tasks} task${cleared.tasks === 1 ? "" : "s"} done`,
    cleared.lines === 0 ? null : `${cleared.lines} line${cleared.lines === 1 ? "" : "s"} started`,
  ].filter((part) => part !== null);
  const last = parts.pop();
  if (last === undefined) return null;
  return `You cleared today: ${parts.length === 0 ? last : `${parts.join(", ")} and ${last}`}.`;
}
