import type { FeedEvent } from "@octotrack/core/schemas";
import { timeLabel } from "../../lib/format.ts";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";

/** One change in the log: when, what it says with its refs openable, then who. */
export function LogRow({ event }: { event: FeedEvent }) {
  return (
    <Row
      lead={timeLabel(event.ts)}
      wideLead
      quiet
      title={<RefText text={event.summary} />}
      facts={event.actor}
    />
  );
}
