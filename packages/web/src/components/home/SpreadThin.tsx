import type { ReactNode } from "react";
import { Glyph } from "../ui/Badge.tsx";
import { Fact, Facts } from "../ui/Facts.tsx";
import { TextLink } from "../ui/RefLink.tsx";

/** Past this many working lines, the header says what spreading thin costs: a nudge to table, never a cap. */
const SPREAD_THIN_AFTER = 6;

/**
 * What working on many lines at once costs, in Working on's header: "▲ 3 with no owner", "● 2 waiting on you", each
 * with its glyph so it never rests on colour alone.
 */
export function SpreadThin({
  working,
  noOwner,
  waiting,
  onNoOwner,
  onWaiting,
}: {
  working: number;
  noOwner: number;
  waiting: number;
  /** Jumps to the first line with no owner. */
  onNoOwner?: () => void;
  /** Jumps to the first line waiting on you. */
  onWaiting?: () => void;
}) {
  if (working <= SPREAD_THIN_AFTER || (noOwner === 0 && waiting === 0)) return null;
  return (
    <Facts>
      {noOwner === 0 ? null : (
        <Fact tone="stuck">
          <Glyph tone="warn">▲</Glyph> <Jump onJump={onNoOwner}>{noOwner} with no owner</Jump>
        </Fact>
      )}
      {waiting === 0 ? null : (
        <span>
          <Glyph tone="attention">●</Glyph> <Jump onJump={onWaiting}>{`${waiting} waiting on you`}</Jump>
        </span>
      )}
    </Facts>
  );
}

/** A count that jumps to the first line it counts, when the page says where that is. */
function Jump({ onJump, children }: { onJump: (() => void) | undefined; children: ReactNode }) {
  return onJump === undefined ? children : <TextLink onClick={onJump}>{children}</TextLink>;
}
