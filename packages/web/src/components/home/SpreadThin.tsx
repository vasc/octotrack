import { Fact, Facts } from "../ui/Facts.tsx";

/** Past this many working lines, the header says what spreading thin costs: a nudge to table, never a cap. */
export const SPREAD_THIN_AFTER = 6;

/** What working on many lines at once costs, in Working on's header: lines with no owner, lines waiting on you. */
export function SpreadThin({
  working,
  noOwner,
  waiting,
}: {
  working: number;
  noOwner: number;
  waiting: number;
}) {
  if (working <= SPREAD_THIN_AFTER || (noOwner === 0 && waiting === 0)) return null;
  return (
    <Facts>
      {noOwner === 0 ? null : <Fact tone="stuck">{noOwner} with no owner</Fact>}
      {waiting === 0 ? null : `${waiting} waiting on you`}
    </Facts>
  );
}
