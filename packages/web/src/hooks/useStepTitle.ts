import { contracts } from "@octotrack/core/contracts";
import { useOpQuery } from "./useOp.ts";

/** The title of a line's plan step, such as "the final print", once its plan has loaded; null with no line or step. */
export function useStepTitle(line: string | null, step: number | null): string | null {
  const shown = useOpQuery(
    contracts.lineShow,
    { ref: line ?? "" },
    { enabled: line !== null && step !== null },
  );
  return shown.data?.steps.find((candidate) => candidate.position === step)?.title ?? null;
}
