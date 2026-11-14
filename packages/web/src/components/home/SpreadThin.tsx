/** Past this many working lines, the header says what spreading thin costs: a nudge to table, never a cap. */
export const SPREAD_THIN_AFTER = 6;

/**
 * What working on many lines at once is costing, in Working on's header as E-States draws it: lines with no owner,
 * lines waiting on the developer. A nudge to table, never a cap; nothing up to six lines.
 */
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
    noOwner === 0 ? null : `${noOwner} with no owner`,
    waiting === 0 ? null : `${waiting} waiting on you`,
  ].filter((cost) => cost !== null);
  return (
    <span
      className="spread-thin"
      role="note"
      aria-label={`${working} lines are being worked on${costs.length === 0 ? "" : `: ${costs.join(", ")}`}. Tabling some gives the rest their agents back.`}
    >
      {noOwner === 0 ? null : (
        <span className="spread-thin-cost" data-tone="bad">
          {noOwner} with no owner
        </span>
      )}
      {waiting === 0 ? null : (
        <span className="spread-thin-cost" data-tone="attention">
          {waiting} waiting on you
        </span>
      )}
    </span>
  );
}
