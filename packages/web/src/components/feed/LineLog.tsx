import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { LogGroup } from "./LogGroup.tsx";

/** One line's part of what is not seen: its number, title, ref and headline, then its changes. */
export function LineLog({
  line,
  number,
  events,
}: {
  line: Line;
  number: number;
  events: readonly FeedEvent[];
}) {
  return (
    <LogGroup
      label={line.title}
      mark={<span className="line-num">{number}</span>}
      name={
        <>
          <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
            {line.title}
          </button>{" "}
          <span className="mono muted">{line.ref}</span>
        </>
      }
      headline={line.headline}
      events={events}
    />
  );
}
