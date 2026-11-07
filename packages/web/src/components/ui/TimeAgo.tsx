import { timeAgo } from "../../lib/format.ts";

export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time className="chip chip--static" dateTime={iso} title={iso}>
      {timeAgo(iso)}
    </time>
  );
}
