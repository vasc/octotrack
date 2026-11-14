import type { Line } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";

/** The line's summary: its headline, which home, the log and the phone show alone, then the rest, and how fresh it is. */
export function SummaryBox({ line, owner }: { line: Line; owner: string | null }) {
  const when = line.summaryAt === null ? null : line.summaryAt.slice(11, 16);
  return (
    <section className="summary-box" aria-label="Summary">
      <div className="summary-head">
        <h2 className="panel-label">Summary</h2>
        {line.summary === null ? (
          <span className="muted">none yet{owner === null ? "" : `; ${owner} writes it`}</span>
        ) : (
          <span className="summary-current">
            current{line.summaryAt === null ? "" : ` · at ${when}`}
            {owner === null ? "" : ` · ${owner} keeps it`}
          </span>
        )}
      </div>
      {line.headline === null ? null : (
        <p className="summary-text">
          <b>
            <Markdown text={line.headline} inline />
          </b>{" "}
          <span className="muted">(the headline: home, the log and the phone show only this)</span>
        </p>
      )}
      {line.summary === null ? null : (
        <div className="summary-text">
          <Markdown text={line.summary} />
        </div>
      )}
    </section>
  );
}
