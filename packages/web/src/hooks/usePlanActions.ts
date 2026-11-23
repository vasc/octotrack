import { contracts } from "@octotrack/core/contracts";
import type { PlanBranch, PlanStep } from "@octotrack/core/schemas";
import { useState } from "react";
import type { PlanActions } from "../components/entity/PlanList.tsx";
import { useChoices } from "./useChoices.ts";
import { useOpMutation } from "./useOp.ts";

/** Making a branch its own line, as the sheet gathers it. */
export interface Promotion {
  title: string;
  doneWhen: string;
  where: "working" | "up_next";
}

/**
 * The developer's changes to a line's plan from its panel. A step's status and what a branch holds up take effect at
 * once, since picking again puts them back; removing a branch and making it a line wait with Undo, as a line's moves
 * do. Renaming a branch or making it a line opens a sheet.
 */
export function usePlanActions(line: string) {
  const choices = useChoices();
  const status = useOpMutation(contracts.planStep);
  const branch = useOpMutation(contracts.planBranchUpdate);
  const path = useOpMutation(contracts.planSet);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editing, setEditing] = useState<{ branch: PlanBranch; steps: readonly PlanStep[] } | null>(null);
  const [promoting, setPromoting] = useState<PlanBranch | null>(null);
  const statusAt = typeof status.variables?.step === "string" ? status.variables.step : null;
  // Every change names its step or branch by id as well, so one sent after Undo's window, or from a sheet left open,
  // reaches the same one though its address moved meanwhile.
  const branchAt = branch.variables?.branch ?? null;
  const failed =
    status.error !== null && statusAt !== null
      ? { at: statusAt, message: status.error.message }
      : branch.error !== null && branchAt !== null
        ? { at: branchAt, message: branch.error.message }
        : null;
  const actions: PlanActions = {
    onStatus: (step, next) => {
      status.reset();
      branch.reset();
      status.mutate({ line, step: step.address, stepId: step.id, status: next });
    },
    onHoldsUp: (target, step) => {
      status.reset();
      branch.reset();
      branch.mutate({ line, branch: target.address, id: target.id, holdsUp: step });
    },
    onEdit: (target, steps) => setEditing({ branch: target, steps }),
    onEditPlan: () => setEditingPlan(true),
    planBusy: path.isPending,
    planFailed: path.error === null ? null : path.error.message,
    onPromote: (target) => setPromoting(target),
    onRemove: (target) =>
      choices.make(
        contracts.planBranchRemove.name,
        { line, branch: target.address, id: target.id },
        target.became === null
          ? `Removing branch ${target.address}, ${target.title}`
          : `Removing branch ${target.address}; ${target.became.ref} stays a line of its own`,
      ),
    busy: status.isPending ? statusAt : branch.isPending ? branchAt : null,
    failed,
  };
  return {
    actions,
    /** The branch being renamed or given new steps, in its sheet. */
    editing,
    /** The branch being made its own line, in its sheet. */
    promoting,
    /** The critical path is being rewritten, in its sheet. */
    editingPlan,
    savePlan: (steps: readonly string[], seen: readonly number[]) => {
      path.reset();
      path.mutate({ line, steps: [...steps], expect: [...seen] });
      setEditingPlan(false);
    },
    save: (title: string, steps: readonly string[]) => {
      if (editing === null) return;
      status.reset();
      branch.reset();
      branch.mutate({
        line,
        branch: editing.branch.address,
        id: editing.branch.id,
        title,
        steps: [...steps],
      });
      setEditing(null);
    },
    promote: (input: Promotion) => {
      if (promoting === null) return;
      choices.make(
        contracts.planPromote.name,
        { line, branch: promoting.address, id: promoting.id, ...input },
        `Making ${promoting.address} its own line: ${input.title}`,
      );
      setPromoting(null);
    },
    cancel: () => {
      setEditing(null);
      setPromoting(null);
      setEditingPlan(false);
    },
  };
}
