import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import { z } from "zod";
import type { NewLine, NewLineDraft } from "../components/lines/NewLineSheet.tsx";
import { useChoices } from "./useChoices.ts";
import { useDraft } from "./useDraft.ts";
import { useOpQuery } from "./useOp.ts";

/** The draft New line keeps on the tracker, so closing the sheet or changing device loses nothing. */
const DRAFT_KEY = "new-line";

const Stored = z.object({ title: z.string(), doneWhen: z.string() });

function parse(text: string): NewLineDraft {
  if (text === "") return { title: "", doneWhen: "" };
  try {
    const parsed = Stored.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : { title: text, doneWhen: "" };
  } catch {
    return { title: text, doneWhen: "" };
  }
}

/**
 * What New line needs, from any page: the repos to pick from, its draft as it is typed, and adding the line as a choice
 * that waits with Undo, which deletes the draft once it takes effect.
 */
export function useNewLine() {
  const projects = useOpQuery(contracts.projectList, {});
  const choices = useChoices();
  const draft = useDraft(DRAFT_KEY);
  const repos = useMemo(() => (projects.data ?? []).map((card) => card.project.ref), [projects.data]);
  return {
    repos,
    draft: parse(draft.value),
    draftError: draft.error,
    setDraft: (next: NewLineDraft) =>
      next.title === "" && next.doneWhen === "" ? draft.clear() : draft.change(JSON.stringify(next)),
    add: (line: NewLine) =>
      void draft
        .flush()
        .then(() =>
          choices.make(
            contracts.lineAdd.name,
            line,
            line.where === "working"
              ? `Starting ${line.title}`
              : line.where === "tabled"
                ? `Tabling ${line.title}`
                : `Adding ${line.title} to up next`,
            DRAFT_KEY,
          ),
        ),
  };
}
