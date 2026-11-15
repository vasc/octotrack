import { timeAgo } from "../../lib/format.ts";

/** How long ago, in a few grey characters: now, 5m, 2h, 3d; the exact time under the pointer. */
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time className="ui-time" dateTime={iso} title={iso}>
      {timeAgo(iso)}
    </time>
  );
}
