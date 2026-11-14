/** Past this many working lines, the header says what spreading thin costs: a nudge to table, never a cap. */
export const SPREAD_THIN_AFTER = 6;

/** How many lines are worked on, and what that costs: lines with no owner, lines waiting on the developer. */
export function SpreadThin({
  working,
  noOwner,
  waiting,
}: {
  working: number;
  noOwner: number;
  waiting: number;
}) {
  if (working <= SPREAD_THIN_AFTER) return null;
  const costs = [
    noOwner === 0 ? null : `${noOwner} ${noOwner === 1 ? "has" : "have"} no owner`,
    waiting === 0 ? null : `${waiting} ${waiting === 1 ? "waits" : "wait"} on you`,
  ].filter((cost) => cost !== null);
  return (
    <p className="home-nudge">
      {working} lines are being worked on{costs.length === 0 ? "" : `: ${costs.join(", ")}`}. Tabling some
      gives the rest their agents back.
    </p>
  );
}
