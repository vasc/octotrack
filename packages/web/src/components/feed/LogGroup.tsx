import type { FeedEvent } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { isRoutine, routineSentence } from "../../lib/log.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { LogRow } from "./LogRow.tsx";

/**
 * A group of changes not seen: a head with its mark, name and headline, each change a row, and the routine ones in one
 * sentence. With only routine changes the sentence sits in the head; with none, the head says nothing is new.
 */
export function LogGroup({
  label,
  mark,
  name,
  headline = null,
  events,
}: {
  /** What the group is called to a screen reader. */
  label: string;
  /** The line's number, or a dot for a group that is no line. */
  mark: ReactNode;
  name: ReactNode;
  headline?: string | null;
  events: readonly FeedEvent[];
}) {
  const rows = events.filter((event) => !isRoutine(event));
  const sentence = routineSentence(events);
  return (
    <article className="log-line" aria-label={label}>
      <div className="log-line-head">
        {mark}
        <span>
          {name}
          {events.length === 0 ? <span className="muted"> · nothing new</span> : null}
          {events.length > 0 && rows.length === 0 ? (
            <span className="muted"> · {sentence}, all routine</span>
          ) : null}
          {rows.length === 0 || headline === null ? null : (
            <span className="log-headline">
              <Markdown text={headline} inline />
            </span>
          )}
        </span>
        {rows.length === 0 ? null : <span className="log-unseen">{rows.length} unseen</span>}
      </div>
      {rows.length === 0 ? null : (
        <ul className="log-rows">
          {rows.map((event) => (
            <LogRow key={event.seq} event={event} />
          ))}
          {sentence === null ? null : <li className="muted">Also routine: {sentence}.</li>}
        </ul>
      )}
    </article>
  );
}
