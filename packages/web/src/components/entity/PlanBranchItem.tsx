import type { PlanBranchNode } from "@octotrack/core/plan";
import type { LineWork, PlanBranch, PlanStep } from "@octotrack/core/schemas";
import { currentStep } from "@octotrack/core/schemas";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { Facts } from "../ui/Facts.tsx";
import { Icon } from "../ui/Icon.tsx";
import { List } from "../ui/List.tsx";
import { Rail } from "../ui/Rail.tsx";
import { Row } from "../ui/Row.tsx";
import { BranchMenu } from "./BranchMenu.tsx";
import type { PlanActions } from "./PlanList.tsx";
import { PlanStepItem, StepTitle } from "./PlanStepItem.tsx";

/** What a branch holds up, in a few words: "holds up step 3", or "holds nothing up". */
function holdsText(branch: PlanBranch): string {
  return branch.holdsUp === null ? "holds nothing up" : `holds up step ${branch.holdsUp}`;
}

/**
 * A branch of a plan, on a rail under the step it forks from: its address, title and what it holds up, its More while
 * the line has not ended, then its own steps. One that became a line is one row that opens that line.
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
  if (branch.became !== null) {
    const became = branch.became;
    return (
      <Rail label={label}>
        <Row
          lead={<Icon name="branch" />}
          title={<StepTitle address={branch.address} title={branch.title} />}
          facts={
            <Facts>
              {`its own line now: ${became.ref}`}
              {LINE_STATE_LABEL[became.state].toLowerCase()}
              {holdsText(branch)}
            </Facts>
          }
          openLabel={`Open ${became.ref}, ${became.title}`}
          onOpen={() => openEntity(became.ref)}
        />
      </Rail>
    );
  }
  const steps = node.steps.map((child) => child.step);
  const current = currentStep(steps);
  const doneCount = steps.filter((step) => step.status === "done").length;
  return (
    <Rail label={label}>
      <List>
        <Row
          lead={<Icon name="branch" />}
          title={<StepTitle address={branch.address} title={branch.title} />}
          facts={
            <Facts>
              {branch.state === "done" ? "done" : holdsText(branch)}
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
                failed={actions.failed?.at === branch.address ? actions.failed.message : undefined}
              />
            )
          }
        />
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
          />
        ))}
      </List>
    </Rail>
  );
}
