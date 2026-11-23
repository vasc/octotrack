import type { PlanNode } from "@octotrack/core/plan";
import type { LineWork, PlanBranch, PlanStep, PlanStepStatus } from "@octotrack/core/schemas";
import { Fact, Facts } from "../ui/Facts.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Step, StepMark, type StepState } from "../ui/Steps.tsx";
import { PlanBranchItem } from "./PlanBranchItem.tsx";
import type { PlanActions } from "./PlanList.tsx";
import { StepStatusMenu } from "./StepStatusMenu.tsx";
import { WorkList } from "./WorkList.tsx";

/**
 * What a step waits on, after a merge mark, in the warm tone as triage/T-Line draws it: a branch by its address, a line
 * by its ref, and "tabled" after a line that is, since then nothing will finish it until it starts.
 */
function WaitsOn({ refs, branches }: { refs: readonly string[]; branches: readonly PlanBranch[] }) {
  const words = refs.map((ref) => {
    const became = branches.find((branch) => branch.became?.ref === ref)?.became;
    return became !== undefined && became !== null && became.state === "tabled" ? `${ref}, tabled` : ref;
  });
  return (
    <Fact tone="stuck">
      <Icon name="joins" /> waits on {words.join(" and ")}
    </Fact>
  );
}

/**
 * One step of a plan, as drawn on triage/T-Line: its round mark, which is its status menu while there are actions, its
 * address and title, "now" in the accent, what it waits on in the warm tone; the issues on it, then each branch forking
 * from it on an elbow.
 */
export function PlanStepItem({
  node,
  now,
  sequence,
  branches,
  work,
  foldMerged,
  actions,
  small = false,
}: {
  node: PlanNode;
  /** It is its sequence's current step. */
  now: boolean;
  /** Every step of the sequence it is on, for what its branches may hold up. */
  sequence: readonly PlanStep[];
  /** Every branch of the plan, for what it waits on. */
  branches: readonly PlanBranch[];
  work: readonly LineWork[];
  foldMerged: boolean;
  /** Setting statuses and changing branches; without it, the plan only says how it stands. */
  actions: PlanActions | undefined;
  /** A step of a branch, drawn smaller under it. */
  small?: boolean;
}) {
  const { step } = node;
  const state: StepState = step.status === "done" ? "done" : now ? "now" : "next";
  const under = work.filter((item) => item.step === step.id);
  const later = sequence.filter((other) => other.position > step.position);
  const facts = [
    ...(now
      ? [
          <Fact key="now" tone="now">
            now
          </Fact>,
        ]
      : []),
    ...(node.waitsOn.length === 0 ? [] : [<WaitsOn key="waits" refs={node.waitsOn} branches={branches} />]),
  ];
  return (
    <Step
      label={`Step ${step.address}, ${step.title}`}
      address={step.address}
      title={step.title}
      state={state}
      small={small}
      mark={
        actions === undefined ? (
          <StepMark state={state} said />
        ) : (
          <StepStatusMenu
            step={step}
            mark={state}
            onStatus={(next: PlanStepStatus) => actions.onStatus(step, next)}
            busy={actions.busy === step.address}
            failed={actions.failed?.at === step.address ? actions.failed.message : undefined}
          />
        )
      }
      {...(facts.length === 0 ? {} : { facts: <Facts>{facts}</Facts> })}
    >
      {under.length === 0 && node.branches.length === 0 ? null : (
        <>
          {under.length === 0 ? null : <WorkList items={under} foldMerged={foldMerged} />}
          {node.branches.map((branch) => (
            <PlanBranchItem
              key={branch.branch.id}
              node={branch}
              later={later}
              branches={branches}
              work={work}
              foldMerged={foldMerged}
              actions={actions}
            />
          ))}
        </>
      )}
    </Step>
  );
}
