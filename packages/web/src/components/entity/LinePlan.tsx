import type { LineView } from "../../hooks/useLineView.ts";
import { issuesOnBranch } from "../../lib/lines.ts";
import { BranchEditSheet } from "../lines/BranchEditSheet.tsx";
import { PromoteSheet } from "../lines/PromoteSheet.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { PlanList } from "./PlanList.tsx";

/** A line's plan as a tree, with the sheets that change a branch or make it its own line. */
export function LinePlan({ view }: { view: LineView }) {
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
          actions={plan.actions}
        />
      </Loaded>
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
