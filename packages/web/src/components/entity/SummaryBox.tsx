import type { Line } from "@octotrack/core/schemas";
import { Markdown } from "../ui/Markdown.tsx";
import { Section } from "../ui/Section.tsx";

/** The line's summary: its headline, then the rest, and how fresh it is. */
export function SummaryBox({ line }: { line: Line }) {
  const fresh =
    line.summary === null
      ? "none yet"
      : line.summaryAt === null
        ? "current"
        : `at ${line.summaryAt.slice(11, 16)}`;
  return (
    <Section title="Summary" aside={fresh}>
      {line.headline === null ? null : <Markdown text={line.headline} />}
      {line.summary === null ? null : <Markdown text={line.summary} />}
    </Section>
  );
}
