import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { entriesOf } from "../lib/forYou.ts";
import { runningAgents } from "../lib/lines.ts";
import { useOpQuery } from "./useOp.ts";

/** How far the bar counts what is unseen in the Log before it says "and more". */
const UNSEEN_COUNTED = 100;

/**
 * What the bar says: how much waits on the developer, as For you lists it, or null while it loads; and for More, how
 * much is unseen in the Log and how many agents are working, or nothing while they load or when there is none.
 */
export function useTopBar() {
  const home = useOpQuery(contracts.homeShow, {});
  const unseen = useOpQuery(contracts.feedList, { unseen: true, limit: UNSEEN_COUNTED });
  const data = home.data;
  const waiting = useMemo(() => (data === undefined ? null : entriesOf(data, "all").length), [data]);
  const working = data === undefined ? 0 : runningAgents(data);
  return {
    waiting,
    ...moreNotes(unseen.data?.events.length ?? 0, unseen.data?.nextBefore != null, working),
  };
}

/** What More says beside the Log and Agents: how much is unseen, "100+" past what was counted, and who is working. */
export function moreNotes(
  unseen: number,
  more: boolean,
  working: number,
): { logNote: string | null; agentsNote: string | null } {
  return {
    logNote: unseen === 0 ? null : `${unseen}${more ? "+" : ""} unseen`,
    agentsNote: working === 0 ? null : `${working} working`,
  };
}
