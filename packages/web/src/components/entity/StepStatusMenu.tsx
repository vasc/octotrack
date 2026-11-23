import type { PlanStep, PlanStepStatus } from "@octotrack/core/schemas";
import { Menu, MenuItem } from "../ui/Menu.tsx";
import { StepMark, type StepState } from "../ui/Steps.tsx";

const WORDS: readonly (readonly [PlanStepStatus, string])[] = [
  ["todo", "To do"],
  ["doing", "Under way"],
  ["done", "Done"],
];

/** A step's status in words: "to do", "under way", "done". */
export function stepStatusWords(status: PlanStepStatus): string {
  return (WORDS.find(([value]) => value === status)?.[1] ?? status).toLowerCase();
}

/** A plan step's status as a menu whose button is the step's round mark: to do, under way or done, the one in force ticked. */
export function StepStatusMenu({
  step,
  mark,
  onStatus,
  busy = false,
  failed,
}: {
  step: PlanStep;
  /** How its mark shows the step: done, the one now, or still to come. */
  mark: StepState;
  onStatus(status: PlanStepStatus): void;
  /** Its change is on its way. */
  busy?: boolean;
  /** Why its last change did not work, said under the button until the next try. */
  failed?: string | undefined;
}) {
  const words = stepStatusWords(step.status);
  return (
    <Menu
      label={`Step ${step.address}, ${step.title}: ${words}`}
      face={<StepMark state={mark} />}
      align="start"
      menuLabel={`Step ${step.address}'s status`}
      busy={busy ? "Changing…" : undefined}
      failed={failed === undefined ? undefined : `Not changed: ${failed}`}
    >
      {(close) =>
        WORDS.map(([status, label]) => (
          <MenuItem
            key={status}
            checked={status === step.status}
            onSelect={() => {
              close();
              if (status !== step.status) onStatus(status);
            }}
          >
            {label}
          </MenuItem>
        ))
      }
    </Menu>
  );
}
