import type { FeedEvent } from "@octotrack/core/schemas";
import { timeLabel } from "../../lib/format.ts";
import { RefText } from "../ui/RefText.tsx";

/** One change in the log: when, and what it says, with its refs openable. */
export function LogRow({ event }: { event: FeedEvent }) {
  return (
    <li className="log-row">
      <span className="muted">{timeLabel(event.ts)}</span>
      <span>
        <RefText text={event.summary} />
      </span>
    </li>
  );
}
