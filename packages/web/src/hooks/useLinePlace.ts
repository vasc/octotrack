import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "./useOp.ts";

/** Where a line stands in the developer's order: its number on Lines, working on then up next, and its title. */
export interface LinePlace {
  ref: string;
  number: number | null;
  title: string;
}

/** A line's number and title, for anything that names its line, such as a question's strip or the Undo bar. */
export function useLinePlace(ref: string | null): LinePlace | null {
  const home = useOpQuery(contracts.homeShow, {});
  const data = home.data;
  if (ref === null || data === undefined) return null;
  const ordered = [...data.working, ...data.upNext];
  const at = ordered.findIndex((line) => line.ref === ref);
  const line =
    ordered[at] ?? [...data.proposed, ...data.tabled, ...data.doneLately].find((other) => other.ref === ref);
  return line === undefined ? null : { ref, number: at === -1 ? null : at + 1, title: line.title };
}
