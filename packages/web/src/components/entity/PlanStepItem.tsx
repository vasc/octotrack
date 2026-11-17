import type { LineWork, PlanBranch, PlanStep, PlanStepStatus } from "@octotrack/core/schemas";
import type { PlanNode } from "@octotrack/core/plan";
import { Fact, Facts } from "../ui/Facts.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Code } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { PlanBranchItem } from "./PlanBranchItem.tsx";
import type { PlanActions } from "./PlanList.tsx";
import { WorkList } from "./WorkList.tsx";
import { StepStatusMenu } from "./StepStatusMenu.tsx";

/**
 * What a step waits on, after a merge mark: a branch by its address, a line by its ref, warm when that line is tabled,
 * since then nothing will finish it until it starts.
 */
function WaitsOn({ refs, branches }: { refs: readonly string[]; branches: readonly PlanBranch[] }) {
  const words = refs.map((ref) => {
    const became = branches.find((branch) => branch.became?.ref === ref)?.became;
    return became !== undefined && became !== null && became.state === "tabled" ? `${ref}, tabled` : ref;
  });
  const said = (
    <>
      <Icon name="joins" /> waits on {words.join(" and ")}
    </>
  );
  return words.some((word) => word.endsWith(", tabled")) ? <Fact tone="stuck">{said}</Fact> : said;
}

/** A step's address before its title, in the plan's small figures: "2a.1 Pick a board". */
export function StepTitle({ address, title }: { address: string; title: string }) {
  return (
    <>
      <Code>{address}</Code> {title}
    </>
  );
}

/**
 * One step of a plan: done, now or next; what it waits on; its status menu while the line has not ended; the issues on
 * it; then each branch forking from it, on a rail.
 */
export function PlanStepItem({
  node,
  now,
  sequence,
  branches,
  work,
  foldMerged,
  actions,
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
}) {
  const { step } = node;
  const done = step.status === "done";
  const under = work.filter((item) => item.step === step.id);
  const facts = [
    ...(now
      ? [
          <Fact key="now" tone="strong">
            now
          </Fact>,
        ]
      : actions === undefined
        ? [done ? "done" : "next"]
        : []),
    ...(node.waitsOn.length === 0 ? [] : [<WaitsOn key="waits" refs={node.waitsOn} branches={branches} />]),
  ];
  const later = sequence.filter((other) => other.position > step.position);
  return (
    <Row
      lead={<Icon name={done ? "check" : now ? "arrow" : "ring"} />}
      title={<StepTitle address={step.address} title={step.title} />}
      label={`Step ${step.address}, ${step.title}`}
      {...(facts.length === 0 ? {} : { facts: <Facts>{facts}</Facts> })}
      trailing={
        actions === undefined ? undefined : (
          <StepStatusMenu
            step={step}
            onStatus={(next: PlanStepStatus) => actions.onStatus(step, next)}
            busy={actions.busy === step.address}
            failed={actions.failed?.at === step.address ? actions.failed.message : undefined}
          />
        )
      }
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
    </Row>
  );
}
