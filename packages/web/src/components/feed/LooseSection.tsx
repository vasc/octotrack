import type { FeedEvent } from "@octotrack/core/schemas";
import { LogGroup } from "./LogGroup.tsx";

/** What each group of changes outside the listed lines holds, said after its name. */
const HOLDS: Readonly<Record<"On no line" | "Elsewhere", string>> = {
  "On no line": "changes to things that belong to no line",
  Elsewhere: "on lines not listed above",
};

/** Changes on no line, or on a line this page does not list: one group, so nothing not seen is dropped. */
export function LooseSection({
  title,
  events,
}: {
  title: "On no line" | "Elsewhere";
  events: readonly FeedEvent[];
}) {
  if (events.length === 0) return null;
  return <LogGroup label={title} title={title} refText={HOLDS[title]} events={events} />;
}
