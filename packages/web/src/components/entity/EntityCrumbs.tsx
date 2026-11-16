import type { EntitySummary } from "@octotrack/core/schemas";
import { KIND_WORD } from "../../lib/format.ts";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { Code } from "../ui/Note.tsx";

/** Where an item opened by its ref sits: what kind of item it is in words, its ref, and its repo. */
export function EntityCrumbs({ summary }: { summary: EntitySummary }) {
  return (
    <Facts>
      <Kind tone="none">{KIND_WORD[summary.kind] ?? summary.kind}</Kind>
      <Code>{summary.ref}</Code>
      {summary.project === null || summary.project === summary.ref ? null : <Code>{summary.project}</Code>}
    </Facts>
  );
}
