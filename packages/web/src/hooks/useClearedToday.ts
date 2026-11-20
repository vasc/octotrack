import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { useOpQuery } from "./useOp.ts";

/** What the developer cleared, as the Log searches it: their answers, their tasks done, the lines they started. */
export const CLEARED_QUERY = "actor:dev event:decision.resolved,task.done,line.started";

/** How far back the count looks, in events: more than a day's clearing. */
const LOOKED_AT = 200;

/**
 * What the developer cleared today, counted from the Log: questions answered, tasks done, lines started; null while it
 * loads or if it could not.
 */
export function useClearedToday(
  enabled: boolean,
): { questions: number; tasks: number; lines: number } | null {
  const feed = useOpQuery(contracts.feedList, { query: CLEARED_QUERY, limit: LOOKED_AT }, { enabled });
  return useMemo(() => {
    if (feed.data === undefined) return null;
    const today = new Date().toDateString();
    const events = feed.data.events.filter((event) => new Date(event.ts).toDateString() === today);
    const count = (type: string) => events.filter((event) => event.type === type).length;
    return { questions: count("decision.resolved"), tasks: count("task.done"), lines: count("line.started") };
  }, [feed.data]);
}
