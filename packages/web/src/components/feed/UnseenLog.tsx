import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";
import { EmptyState } from "../ui/states.tsx";
import { LineLog } from "./LineLog.tsx";
import { LogRow } from "./LogRow.tsx";
import { LooseSection } from "./LooseSection.tsx";

/**
 * Rule breaks, and work that reached a line after it was told to stop: always shown, at the top, whatever is filtered
 * or left out.
 */
const REFUSED: ReadonlySet<string> = new Set([
  "write.refused",
  "agent.would_stop",
  "agent.stopped",
  "pr.after_wind_down",
]);

/** Lines that show only when something changed on them. */
const ONLY_WHEN_CHANGED: ReadonlySet<Line["state"]> = new Set(["proposed", "done", "dropped"]);

/** Lines whose changes wait until asked for: up next and tabled are quiet. Every other line is shown. */
const QUIET: ReadonlySet<Line["state"]> = new Set(["up_next", "tabled"]);

/**
 * What the developer has not seen, as E-Feed draws it: rule breaks at the top, then line by line in their order, each
 * change a row, with checks and drift confirmations folded into one sentence. Up-next and tabled lines are left out
 * unless asked for.
 */
export function UnseenLog({
  events,
  lines,
  includeWaiting,
  onShowWaiting,
}: {
  events: readonly FeedEvent[];
  /** Every line, in the developer's order. */
  lines: readonly Line[];
  includeWaiting: boolean;
  onShowWaiting(): void;
}) {
  const refused = events.filter((event) => REFUSED.has(event.type));
  // A proposal or a finished line shows only when something changed on it: "nothing new" on each would bury the rest.
  const changed = new Set(events.map((event) => event.line));
  const shown = lines
    .filter((line) => includeWaiting || !QUIET.has(line.state))
    .filter((line) => !ONLY_WHEN_CHANGED.has(line.state) || changed.has(line.ref));
  const waiting = lines.filter((line) => QUIET.has(line.state));
  const known = new Set(lines.map((line) => line.ref));
  const loose = events.filter((event) => event.line === null && !REFUSED.has(event.type));
  // A line this page does not list, such as one ended a while ago: its changes still show, never dropped.
  const elsewhere = events.filter(
    (event) => event.line !== null && !known.has(event.line) && !REFUSED.has(event.type),
  );
  const leftOut = includeWaiting
    ? 0
    : events.filter((event) => !REFUSED.has(event.type) && waiting.some((line) => line.ref === event.line))
        .length;
  const sheet = shown.length > 0 || loose.length > 0 || elsewhere.length > 0;
  return (
    <>
      {refused.length === 0 ? null : (
        <Section title="Rule breaks">
          <List>
            {refused.map((event) => (
              <LogRow key={event.seq} event={event} />
            ))}
          </List>
        </Section>
      )}
      {sheet ? (
        <List>
          {shown.map((line, index) => (
            <LineLog
              key={line.ref}
              line={line}
              number={index + 1}
              events={events.filter((event) => event.line === line.ref && !REFUSED.has(event.type))}
            />
          ))}
          <LooseSection title="On no line" events={loose} />
          <LooseSection title="Elsewhere" events={elsewhere} />
        </List>
      ) : refused.length === 0 ? (
        <EmptyState>Nothing new</EmptyState>
      ) : null}
      {includeWaiting || waiting.length === 0 ? null : (
        <Actions>
          <Note>Up next and tabled: {leftOut} more</Note>
          <Button variant="quiet" onClick={onShowWaiting}>
            Show
          </Button>
        </Actions>
      )}
    </>
  );
}
