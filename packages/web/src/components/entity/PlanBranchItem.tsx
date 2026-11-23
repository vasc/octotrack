import type { PlanBranchNode } from "@octotrack/core/plan";
import type { LineWork, PlanBranch, PlanStep } from "@octotrack/core/schemas";
import { currentStep } from "@octotrack/core/schemas";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { StepBranch } from "../ui/Steps.tsx";
import { BranchMenu } from "./BranchMenu.tsx";
import type { PlanActions } from "./PlanList.tsx";
import { PlanStepItem } from "./PlanStepItem.tsx";

/**
 * What a branch holds up, in a few words: "holds up step 3", or "holds nothing up"; a branch whose line ended without
 * being done is "ended", since it holds nothing any more.
 */
function holdsText(branch: PlanBranch): string {
  if (branch.state === "ended") return "ended";
  return branch.holdsUp === null ? "holds nothing up" : `holds up step ${branch.holdsUp}`;
}

/**
 * A branch of a plan, on an elbow under the step it forks from (triage/T-Line): its address, title and what it holds up,
 * its More while it can change, then its own steps. One that became a line says so and links to that line.
 */
export function PlanBranchItem({
  node,
  later,
  branches,
  work,
  foldMerged,
  actions,
}: {
  node: PlanBranchNode;
  /** The steps after the one it forks from: what it may hold up. */
  later: readonly PlanStep[];
  branches: readonly PlanBranch[];
  work: readonly LineWork[];
  foldMerged: boolean;
  actions: PlanActions | undefined;
}) {
  const { branch } = node;
  const label = `Branch ${branch.address}, ${branch.title}`;
  const failed = actions?.failed?.at === branch.address ? actions.failed.message : undefined;
  if (branch.became !== null) {
    const became = branch.became;
    return (
      <StepBranch
        label={label}
        address={branch.address}
        title={branch.title}
        facts={
          <Facts>
            <span>
              became <RefLink value={became.ref} />, {LINE_STATE_LABEL[became.state].toLowerCase()}
            </span>
            {holdsText(branch)}
          </Facts>
        }
        trailing={
          actions === undefined || branch.state === "ended" ? undefined : (
            <BranchMenu
              branch={branch}
              later={later}
              onHoldsUp={(step) => actions.onHoldsUp(branch, step)}
              onRemove={() => actions.onRemove(branch)}
              busy={actions.busy === branch.address}
              failed={failed}
            />
          )
        }
      />
    );
  }
  const steps = node.steps.map((child) => child.step);
  const current = currentStep(steps);
  const doneCount = steps.filter((step) => step.status === "done").length;
  return (
    <StepBranch
      label={label}
      address={branch.address}
      title={branch.title}
      facts={
        <Facts>
          {branch.state === "done" ? "done" : branch.state === "open" ? "open" : ""}
          {branch.state === "done" ? "" : holdsText(branch)}
          {`${doneCount} of ${steps.length} done`}
        </Facts>
      }
      trailing={
        actions === undefined ? undefined : (
          <BranchMenu
            branch={branch}
            later={later}
            onHoldsUp={(step) => actions.onHoldsUp(branch, step)}
            onEdit={() => actions.onEdit(branch, steps)}
            onPromote={() => actions.onPromote(branch)}
            onRemove={() => actions.onRemove(branch)}
            busy={actions.busy === branch.address}
            failed={failed}
          />
        )
      }
    >
      {node.steps.map((child) => (
        <PlanStepItem
          key={child.step.id}
          node={child}
          now={child.step.id === current?.id}
          sequence={steps}
          branches={branches}
          work={work}
          foldMerged={foldMerged}
          actions={actions}
          small
        />
      ))}
    </StepBranch>
  );
}
