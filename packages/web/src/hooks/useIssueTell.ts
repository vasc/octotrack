import { contracts } from "@octotrack/core/contracts";
import type { Issue } from "@octotrack/core/schemas";
import { tellSummary } from "../lib/lines.ts";
import { useChoices } from "./useChoices.ts";
import { useDraft } from "./useDraft.ts";

/** Tell whoever holds an issue: its draft, whether it is on its way, and sending it, which waits with Undo. */
export function useIssueTell(issue: Pick<Issue, "ref" | "line">) {
  const key = `tell:${issue.ref}`;
  const draft = useDraft(key);
  const choices = useChoices();
  return {
    draft,
    sending: choices.waiting(key),
    send(words: string) {
      const line = issue.line;
      if (line === null) return;
      void draft
        .flush()
        .then(() =>
          choices.make(
            contracts.lineTell.name,
            { line, body: words, issue: issue.ref },
            tellSummary(`whoever holds ${issue.ref}`, words),
            key,
          ),
        );
    },
  };
}
