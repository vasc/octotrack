import type { EntitySummary } from "@octotrack/core/schemas";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Code } from "../ui/Note.tsx";

/** Where an item opened by its ref sits: its ref, what kind of item it is, and its state. */
export function EntityCrumbs({ summary }: { summary: EntitySummary }) {
  return (
    <Facts>
      <Code>{summary.ref}</Code>
      <Badge>{summary.kind}</Badge>
      <StatusBadge value={summary.status} />
    </Facts>
  );
}
