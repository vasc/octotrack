import type { Line } from "@octotrack/core/schemas";
import { sinceText } from "../../lib/format.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";

/** The line's summary: how old it is, its headline in bold, then the rest; or who writes one, while there is none. */
export function SummaryBox({ line, now = Date.now() }: { line: Line; now?: number }) {
  const none = line.summary === null && line.headline === null;
  return (
    <Section
      title="Summary"
      {...(none || line.summaryAt === null ? {} : { aside: sinceText(line.summaryAt, now) })}
    >
      {none ? (
        <Note>
          {line.state === "working"
            ? "No summary yet. Its owner writes one."
            : "No summary yet. Its owner writes one once the line starts."}
        </Note>
      ) : null}
      {line.headline === null ? null : (
        <strong>
          <Markdown text={line.headline} inline />
        </strong>
      )}
      {line.summary === null ? null : <Markdown text={line.summary} />}
    </Section>
  );
}
