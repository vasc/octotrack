import { planTree } from "@octotrack/core/plan";
import {
  currentStep,
  type Line,
  type LineWork,
  type PlanBranch,
  type PlanStep,
  type PlanStepStatus,
} from "@octotrack/core/schemas";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { NotDone } from "../ui/NotDone.tsx";
import { Note } from "../ui/Note.tsx";
import { Section } from "../ui/Section.tsx";
import { Steps } from "../ui/Steps.tsx";
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
  /** Opens the sheet that rewrites the critical path; left out where the plan cannot be changed from. */
  onEditPlan?: (() => void) | undefined;
  /** A rewrite of the critical path is on its way. */
  planBusy?: boolean;
  /** Why the last rewrite of the critical path did not take, until the next try. */
  planFailed?: string | null;
  /** The address of the step or branch whose change is on its way. */
  busy?: string | null;
  /** The step or branch whose last change did not work, and why, until the next try. */
  failed?: { at: string; message: string } | null;
}

/**
 * The plan as a tree (D15), as drawn on triage/T-Line: what finishes the line beside its title when given, else how far
 * along it is; its critical path, each step's round mark done, now or next with the issues on it, and under a step the
 * branches forking from it on an elbow with their own steps; then Edit the plan. With actions, on any line, a step's
 * mark is its status menu and every branch has its More.
 */
export function PlanList({
  steps,
  branches = [],
  work,
  state = "working",
  foldMerged = false,
  doneWhen,
  actions,
}: {
  steps: readonly PlanStep[];
  branches?: readonly PlanBranch[];
  work: readonly LineWork[];
  /** How the line stands, which says who writes its plan and when. */
  state?: Line["state"];
  /** On a phone, several merged pull requests fold to one fact so the open work stands out. */
  foldMerged?: boolean;
  /** What finishes the line, said beside the plan's title in place of how far along it is (the line's own page). */
  doneWhen?: string | undefined;
  /** Changing the plan; without it, it only says how it stands. */
  actions?: PlanActions;
}) {
  const path = steps.filter((step) => step.branch === null);
  const current = currentStep(path);
  const placed = new Set(steps.map((step) => step.id));
  const unplaced = work.filter((item) => item.step === null || !placed.has(item.step));
  const open = branches.filter((branch) => branch.state === "open").length;
  const progress =
    path.length === 0
      ? work.length === 0
        ? null
        : `not scoped yet · ${work.length} issue${work.length === 1 ? "" : "s"} already on it`
      : [
          ...(current === undefined ? [] : [`step ${current.position} of ${path.length}`]),
          ...(open === 0 ? [] : [`${open} branch${open === 1 ? "" : "es"} open`]),
        ].join(" · ") || null;
  const aside =
    doneWhen !== undefined && doneWhen !== "" ? (
      <span>
        Done when: <Markdown text={doneWhen} inline />
      </span>
    ) : (
      progress
    );
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
        <Steps>
          {planTree(steps, branches).map((node) => (
            <PlanStepItem
              key={node.step.id}
              node={node}
              now={node.step.id === current?.id}
              sequence={path}
              branches={branches}
              work={work}
              foldMerged={foldMerged}
              actions={actions}
            />
          ))}
          {unplaced.length === 0 ? null : (
            <Labelled label="Not on a step yet">
              <WorkList items={unplaced} foldMerged={foldMerged} />
            </Labelled>
          )}
        </Steps>
      )}
      {(actions?.onEditPlan === undefined || path.length === 0) &&
      (doneWhen === undefined || progress === null) ? null : (
        <Actions>
          {actions?.onEditPlan === undefined || path.length === 0 ? null : (
            <Button
              variant="quiet"
              onClick={actions.onEditPlan}
              busy={actions.planBusy === true ? "Saving…" : undefined}
            >
              Edit the plan
            </Button>
          )}
          {/* With done when beside its title, how far along it is goes at its foot. */}
          {doneWhen === undefined || doneWhen === "" || progress === null ? null : <Note>{progress}</Note>}
        </Actions>
      )}
      {actions?.planFailed === undefined || actions.planFailed === null ? null : (
        <NotDone>{`Plan not changed: ${actions.planFailed}`}</NotDone>
      )}
    </Section>
  );
}
