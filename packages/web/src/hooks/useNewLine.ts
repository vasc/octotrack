import { contracts } from "@octotrack/core/contracts";
import { useMemo } from "react";
import type { NewLine } from "../components/lines/NewLineSheet.tsx";
import { useChoices } from "./useChoices.ts";
import { useOpQuery } from "./useOp.ts";

/** What New line needs, from any page: the repos to pick from, and adding the line as a choice that waits with Undo. */
export function useNewLine() {
  const projects = useOpQuery(contracts.projectList, {});
  const choices = useChoices();
  const repos = useMemo(() => (projects.data ?? []).map((card) => card.project.ref), [projects.data]);
  return {
    repos,
    add: (line: NewLine) =>
      choices.make(
        contracts.lineAdd.name,
        line,
        line.where === "working"
          ? `Starting ${line.title}`
          : line.where === "tabled"
            ? `Tabling ${line.title}`
            : `Adding ${line.title} to up next`,
      ),
  };
}
