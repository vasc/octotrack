import { planTree } from "@octotrack/core/plan";
import {
  currentStep,
  type Line,
  type LineWork,
  type PlanBranch,
  type PlanStep,
  type PlanStepStatus,
} from "@octotrack/core/schemas";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { Section } from "../ui/Section.tsx";
import { PlanStepItem } from "./PlanStepItem.tsx";
import { WorkList } from "./WorkList.tsx";

/** What the developer can do to a plan from the line panel: steps and branches, each by its address. */
export interface PlanActions {
  /** By the step itself, so its id goes along: addresses shift as steps come and go. */
  onStatus(step: PlanStep, status: PlanStepStatus): void;
  onHoldsUp(branch: PlanBranch, step: string | null): void;
  onEdit(branch: PlanBranch, steps: readonly PlanStep[]): void;
  onPromote(branch: PlanBranch): void;
  onRemove(branch: PlanBranch): void;
  /** The address of the step or branch whose change is on its way. */
  busy?: string | null;
  /** The step or branch whose last change did not work, and why, until the next try. */
  failed?: { at: string; message: string } | null;
}

/**
 * The plan as a tree (D15): its critical path, each step done, now or next with the issues on it, and under a step the
 * branches forking from it, each on a rail with its own steps. On a line that has not ended, every step has a status
 * menu and every branch its More.
 */
export function PlanList({
  steps,
  branches = [],
  work,
  state = "working",
  foldMerged = false,
  actions,
}: {
  steps: readonly PlanStep[];
  branches?: readonly PlanBranch[];
  work: readonly LineWork[];
  /** How the line stands, which says who writes its plan and when. */
  state?: Line["state"];
  /** On a phone, several merged pull requests fold to one fact so the open work stands out. */
  foldMerged?: boolean;
  /** Changing the plan; without it, or once the line has ended, it only says how it stands. */
  actions?: PlanActions;
}) {
  const path = steps.filter((step) => step.branch === null);
  const current = currentStep(path);
  const live = actions;
  const placed = new Set(steps.map((step) => step.id));
  const unplaced = work.filter((item) => item.step === null || !placed.has(item.step));
  const open = branches.filter((branch) => branch.state === "open").length;
  const aside =
    path.length === 0
      ? work.length === 0
        ? null
        : `not scoped yet · ${work.length} issue${work.length === 1 ? "" : "s"} already on it`
      : [
          ...(current === undefined ? [] : [`step ${current.position} of ${path.length}`]),
          ...(open === 0 ? [] : [`${open} branch${open === 1 ? "" : "es"} open`]),
        ].join(" · ") || null;
  return (
    <Section title="Plan" {...(aside === null ? {} : { aside })}>
      {path.length === 0 && unplaced.length === 0 ? (
        <Note>
          {state === "done" || state === "dropped"
            ? "No plan was written."
            : state === "working"
              ? "No plan yet. Its owner writes one."
              : "No plan yet. Its owner writes one once it starts."}
        </Note>
      ) : (
        <List>
          {planTree(steps, branches).map((node) => (
            <PlanStepItem
              key={node.step.id}
              node={node}
              now={node.step.id === current?.id}
              sequence={path}
              branches={branches}
              work={work}
              foldMerged={foldMerged}
              actions={live}
            />
          ))}
          {unplaced.length === 0 ? null : (
            <Row title="Not on a step yet">
              <WorkList items={unplaced} foldMerged={foldMerged} />
            </Row>
          )}
        </List>
      )}
    </Section>
  );
}
