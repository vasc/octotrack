import type { FeedEvent, Line } from "@octotrack/core/schemas";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { TextLink } from "../ui/RefLink.tsx";
import { LogGroup } from "./LogGroup.tsx";

/** One line's part of what is not seen: its title opening it, its ref and how it stands, its headline, its changes. */
export function LineLog({ line, events }: { line: Line; events: readonly FeedEvent[] }) {
  return (
    <LogGroup
      label={line.title}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      refText={line.ref}
      state={LINE_STATE_LABEL[line.state].toLowerCase()}
      headline={line.headline}
      events={events}
    />
  );
}
