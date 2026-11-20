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
  nextAsk,
  then,
}: {
  filter: Filter;
  /** Agents running on lines now. */
  working: number;
  /** Where the next ask likely comes from. */
  nextAsk: { title: string; step: string | null } | null;
  /** The next view that holds something, with its name and count. */
  then: { filter: Filter; label: string; count: number } | null;
}) {
  const agents = `${working === 0 ? "No" : working} agent${working === 1 ? " is" : "s are"} working`;
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
      {filter === "all"
        ? `${agents}.${nextAsk === null ? "" : ` The next ask will likely come from ${nextAsk.title}${nextAsk.step === null ? "" : `, at ${nextAsk.step}`}.`}`
        : null}
    </Cleared>
  );
}
