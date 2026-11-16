import type { AtView } from "@octotrack/core/schemas";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";

/** Hours left until I'm at ends by itself, in whole hours, at least one. */
function hoursLeft(until: string, now: number): number {
  return Math.max(1, Math.round((Date.parse(until) - now) / 3_600_000));
}

/** I'm at a place: where, how long until it ends by itself, and Leave. */
export function AtSection({ at, now, onLeave }: { at: AtView; now: number; onLeave(): void }) {
  const hours = hoursLeft(at.until, now);
  return (
    <List>
      <Row
        label={`At ${at.place}`}
        title={`At ${at.place}`}
        facts={<Facts>{`ends by itself in ${hours}h`}</Facts>}
        trailing={<Button onClick={onLeave}>Leave</Button>}
      />
    </List>
  );
}
