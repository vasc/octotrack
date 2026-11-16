import type { FeedEvent } from "@octotrack/core/schemas";
import { type ReactNode, useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
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
  title,
  refText = null,
  state = null,
  headline = null,
  events,
}: {
  /** What the group is called to a screen reader. */
  label: string;
  title: ReactNode;
  refText?: string | null;
  /** How the line stands, after its ref. */
  state?: string | null;
  headline?: string | null;
  events: readonly FeedEvent[];
}) {
  const rows = events.filter((event) => !isRoutine(event));
  const routine = events.filter(isRoutine);
  const sentence = routineSentence(events);
  // Showing the routine changes is a choice on this screen alone, so it is the component's own state.
  const [showRoutine, setShowRoutine] = useState(false);
  return (
    <Row
      label={label}
      title={title}
      facts={
        <Facts>
          {refText}
          {state}
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
          {sentence === null ? null : showRoutine ? (
            <List>
              {routine.map((event) => (
                <LogRow key={event.seq} event={event} />
              ))}
            </List>
          ) : (
            <Actions>
              <Note>Also routine: {sentence}.</Note>
              <Button variant="quiet" onClick={() => setShowRoutine(true)}>
                Show
              </Button>
            </Actions>
          )}
        </>
      )}
    </Row>
  );
}
