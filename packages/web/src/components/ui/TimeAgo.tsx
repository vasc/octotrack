import { timeAgo } from "../../lib/format.ts";

export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time className="chip" dateTime={iso} title={iso} style={{ cursor: "default" }}>
      {timeAgo(iso)}
    </time>
  );
}
