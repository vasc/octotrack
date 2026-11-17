import { contracts } from "@octotrack/core/contracts";
import type { PlanStepStatus } from "@octotrack/core/schemas";
import { useOpMutation } from "./useOp.ts";

/** Setting a step of a line's plan to do, under way or done: which step's change is on its way, and which one failed. */
export interface PlanStatus {
  onStatus(position: number, status: PlanStepStatus): void;
  /** The step whose change is on its way. */
  busy: number | null;
  /** The step whose last change did not work, and why, until the next try. */
  failed: { step: number; message: string } | null;
}

/** Sets one step of a line's plan; the plan is fetched again afterwards, as after every change. */
export function usePlanStatus(line: string): PlanStatus {
  const set = useOpMutation(contracts.planStep);
  const step = set.variables?.step ?? null;
  return {
    onStatus: (position, status) => {
      set.reset();
      set.mutate({ line, step: position, status });
    },
    busy: set.isPending ? step : null,
    failed: set.error === null || step === null ? null : { step, message: set.error.message },
  };
}
