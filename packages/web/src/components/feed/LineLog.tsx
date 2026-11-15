import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { TextLink } from "../ui/RefLink.tsx";
import { LogGroup } from "./LogGroup.tsx";

/** One line's part of what is not seen: its number, title opening it, ref and headline, then its changes. */
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
      lead={number}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      refText={line.ref}
      headline={line.headline}
      events={events}
    />
  );
}
