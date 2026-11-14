import type { FeedEvent } from "@octotrack/core/schemas";
import { LogGroup } from "./LogGroup.tsx";

/** Changes on no line, or on a line this page does not list: one group, so nothing not seen is dropped. */
export function LooseSection({ title, events }: { title: string; events: readonly FeedEvent[] }) {
  if (events.length === 0) return null;
  return (
    <LogGroup
      label={title}
      mark={
        <span className="line-num" aria-hidden="true">
          ·
        </span>
      }
      name={title}
      events={events}
    />
  );
}
