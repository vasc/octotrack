import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "./useOp.ts";

/**
 * A line's plan step by its position: its title, such as "the final print", and how many steps the plan has, once
 * the plan has loaded; null with no line or step.
 */
export function usePlanStep(line: string | null, step: number | null): { title: string; of: number } | null {
  const shown = useOpQuery(
    contracts.lineShow,
    { ref: line ?? "" },
    { enabled: line !== null && step !== null },
  );
  const steps = shown.data?.steps ?? [];
  const found = steps.find((candidate) => candidate.position === step);
  return found === undefined ? null : { title: found.title, of: steps.length };
}
