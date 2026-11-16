import { Glyph } from "../ui/Badge.tsx";
import { Fact, Facts } from "../ui/Facts.tsx";

/** Past this many working lines, the header says what spreading thin costs: a nudge to table, never a cap. */
export const SPREAD_THIN_AFTER = 6;

/**
 * What working on many lines at once costs, in Working on's header: "▲ 3 with no owner", "● 2 waiting on you", each
 * with its glyph so it never rests on colour alone.
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
  if (working <= SPREAD_THIN_AFTER || (noOwner === 0 && waiting === 0)) return null;
  return (
    <Facts>
      {noOwner === 0 ? null : (
        <Fact tone="stuck">
          <Glyph tone="warn">▲</Glyph> {noOwner} with no owner
        </Fact>
      )}
      {waiting === 0 ? null : (
        <span>
          <Glyph tone="attention">●</Glyph> {waiting} waiting on you
        </span>
      )}
    </Facts>
  );
}
