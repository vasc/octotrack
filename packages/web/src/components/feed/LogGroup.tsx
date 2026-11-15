import type { FeedEvent } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { isRoutine, routineSentence } from "../../lib/log.ts";
import { Fact, Facts } from "../ui/Facts.tsx";
import { List } from "../ui/List.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { LogRow } from "./LogRow.tsx";

/**
 * A group of changes not seen, one row: its lead, title and ref, how many are unseen and the headline; under it each
 * change a row, and the routine ones counted. With only routine changes the count is its fact; with none, nothing new.
 */
export function LogGroup({
  label,
  lead,
  title,
  refText = null,
  headline = null,
  events,
}: {
  /** What the group is called to a screen reader. */
  label: string;
  /** The line's number, or a dot for a group that is no line. */
  lead: ReactNode;
  title: ReactNode;
  refText?: string | null;
  headline?: string | null;
  events: readonly FeedEvent[];
}) {
  const rows = events.filter((event) => !isRoutine(event));
  const sentence = routineSentence(events);
  return (
    <Row
      label={label}
      lead={lead}
      title={title}
      facts={
        <Facts>
          {refText}
          {events.length === 0 ? "nothing new" : null}
          {events.length > 0 && rows.length === 0 ? `${sentence}, all routine` : null}
          {rows.length === 0 ? null : <Fact tone="strong">{rows.length} unseen</Fact>}
        </Facts>
      }
      note={rows.length === 0 || headline === null ? undefined : <Markdown text={headline} inline />}
    >
      {rows.length === 0 ? null : (
        <>
          <List>
            {rows.map((event) => (
              <LogRow key={event.seq} event={event} />
            ))}
          </List>
          {sentence === null ? null : <Note>Also routine: {sentence}.</Note>}
        </>
      )}
    </Row>
  );
}
