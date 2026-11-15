import { whenText } from "../../lib/format.ts";
import type { Line } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";

/** A tabled or finished line, shown when its section is opened: why it waits, and how to bring it back. */
export function QuietRow({
  line,
  onStart,
  onQueue,
}: {
  line: Line;
  onStart?: (ref: string) => void;
  onQueue?: (ref: string) => void;
}) {
  return (
    <article className="row" aria-label={line.title}>
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        <div className="row-sub">
          {line.tabledReason === null ? null : <span>{line.tabledReason}</span>}
          {line.lookAgainAt === null ? null : <span>look again {whenText(line.lookAgainAt)}</span>}
        </div>
      </div>
      {onQueue === undefined ? null : (
        <button
          type="button"
          className="btn"
          aria-label={`Up next ${line.title}`}
          onClick={() => onQueue(line.ref)}
        >
          Up next
        </button>
      )}
      {onStart === undefined ? null : (
        <button
          type="button"
          className="btn"
          aria-label={`Start ${line.title}`}
          onClick={() => onStart(line.ref)}
        >
          Start
        </button>
      )}
    </article>
  );
}
