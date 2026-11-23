import type { LineView } from "../../hooks/useLineView.ts";
import { issuesOnBranch } from "../../lib/lines.ts";
import { BranchEditSheet } from "../lines/BranchEditSheet.tsx";
import { PlanEditSheet } from "../lines/PlanEditSheet.tsx";
import { PromoteSheet } from "../lines/PromoteSheet.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { PlanList } from "./PlanList.tsx";

/**
 * A line's plan as a tree, with the sheets that rewrite it, change a branch or make one its own line. On the line's own
 * page what finishes it heads the plan.
 */
export function LinePlan({ view, doneWhen }: { view: LineView; doneWhen?: string | undefined }) {
  const { shown, plan, line } = view;
  return (
    <>
      <Loaded
        loaded={shown.data !== undefined}
        error={shown.error}
        what="the plan"
        onRetry={() => void shown.refetch()}
        at={shown.dataUpdatedAt}
      >
        <PlanList
          steps={shown.data?.steps ?? []}
          branches={shown.data?.branches ?? []}
          work={shown.data?.work ?? []}
          state={line.state}
          foldMerged={view.narrow}
          doneWhen={doneWhen}
          actions={plan.actions}
        />
      </Loaded>
      {plan.editingPlan ? (
        <PlanEditSheet
          steps={(shown.data?.steps ?? []).filter((step) => step.branch === null)}
          onSave={plan.savePlan}
          onCancel={plan.cancel}
        />
      ) : null}
      {plan.editing === null ? null : (
        <BranchEditSheet
          branch={plan.editing.branch}
          steps={plan.editing.steps}
          onSave={plan.save}
          onCancel={plan.cancel}
        />
      )}
      {plan.promoting === null ? null : (
        <PromoteSheet
          branch={plan.promoting}
          issues={issuesOnBranch(shown.data, plan.promoting)}
          onPromote={plan.promote}
          onCancel={plan.cancel}
        />
      )}
    </>
  );
}
