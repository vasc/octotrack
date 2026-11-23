import { clockTime, dayDate, timeAgo } from "../../lib/format.ts";

/** How long ago, in a few grey characters: now, 5m, 2h, 3d; under the pointer, the day and time in words. */
export function TimeAgo({ iso, now }: { iso: string; now?: number }) {
  return (
    <time className="ui-time" dateTime={iso} title={`${dayDate(iso, now)}, ${clockTime(iso)}`}>
      {timeAgo(iso, now)}
    </time>
  );
}
