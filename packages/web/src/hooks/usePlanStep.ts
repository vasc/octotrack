import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "./useOp.ts";

/**
 * A line's plan step by its id: its address and title, such as 3 and "the final print", once the plan has loaded; null
 * with no line or step.
 */
export function usePlanStep(
  line: string | null,
  step: number | null,
): { address: string; title: string } | null {
  const shown = useOpQuery(
    contracts.lineShow,
    { ref: line ?? "" },
    { enabled: line !== null && step !== null },
  );
  const steps = shown.data?.steps ?? [];
  const found = steps.find((candidate) => candidate.id === step);
  return found === undefined ? null : { address: found.address, title: found.title };
}
