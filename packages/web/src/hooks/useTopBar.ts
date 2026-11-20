import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { entriesOf } from "../lib/forYou.ts";
import { useOpQuery } from "./useOp.ts";

/** What the bar says: how much waits on the developer, as For you lists it, or null while it loads. */
export function useTopBar() {
  const home = useOpQuery(contracts.homeShow, {});
  const data = home.data;
  const waiting = useMemo(() => (data === undefined ? null : entriesOf(data, "all").length), [data]);
  return { waiting };
}
