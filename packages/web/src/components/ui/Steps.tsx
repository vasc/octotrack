import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/** Where a step stands: done, the one being worked on now, or still to come. */
export type StepState = "done" | "now" | "next";

const STATE_WORDS: Record<StepState, string> = { done: "done", now: "now", next: "next" };

/**
 * A step's round mark: filled with a check when done, a ring in the accent when it is the step now, a faint ring when it
 * is still to come. It says its state to a screen reader only when nothing else does, such as a menu's name.
 */
export function StepMark({ state, said = false }: { state: StepState; said?: boolean }) {
  return (
    <span className="ui-step-mark" data-state={state}>
      {state === "done" ? <Icon name="check" /> : null}
      {said ? <span className="ui-hidden">{STATE_WORDS[state]}</span> : null}
    </span>
  );
}

/** A plan's steps, one under the other on the sheet they belong to, with no box of their own. */
export function Steps({ children }: { children: ReactNode }) {
  return <div className="ui-steps">{children}</div>;
}

/** A step's address in its plan's figures, then its title: "2 · Restructure the plan". */
function StepName({ address, title }: { address: string; title: ReactNode }) {
  return (
    <span className="ui-step-name">
      <span className="ui-step-address">{address}</span> · <span className="ui-step-title">{title}</span>
    </span>
  );
}

/**
 * One step of a plan: its mark (or the menu that is its mark), its address and title, a few facts after it; the step now
 * on a tint of the accent, a done one in grey. What hangs from it, its issues and branches, sits under its title.
 */
export function Step({
  mark,
  address,
  title,
  state,
  facts,
  label,
  small = false,
  children,
}: {
  /** Its StepMark, or a menu whose button is that mark. */
  mark: ReactNode;
  address: string;
  title: ReactNode;
  state: StepState;
  /** Small words after its title, such as "now" or "waits on L-9". */
  facts?: ReactNode;
  /** Names it for a screen reader: "Step 2, Restructure the plan". */
  label: string;
  /** A step of a branch: a smaller mark, in the branch's smaller words. */
  small?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className="ui-step"
      aria-label={label}
      // Only the critical path's step is the line's current one; a branch's own now is said by its mark and words.
      aria-current={state === "now" && !small ? "step" : undefined}
      data-state={state}
      data-size={small ? "small" : undefined}
    >
      <span className="ui-step-lead">{mark}</span>
      <div className="ui-step-body">
        <span className="ui-step-head">
          <StepName address={address} title={title} />
          {facts === undefined ? null : <span className="ui-step-facts">{facts}</span>}
        </span>
        {children === undefined || children === null || children === false ? null : (
          <div className="ui-step-under">{children}</div>
        )}
      </div>
    </article>
  );
}

/**
 * A branch hanging from its step on an elbow: its address, title and facts, what acts on it at its end, then its own
 * steps under it. A group of its own to a screen reader.
 */
export function StepBranch({
  label,
  address,
  title,
  facts,
  trailing,
  children,
}: {
  /** "Branch 2a, Try it on the phone". */
  label: string;
  address: string;
  title: ReactNode;
  facts?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset groups a form's fields; a branch's rows are grouped by role
    <div className="ui-step-branch" role="group" aria-label={label}>
      <span className="ui-step-elbow" aria-hidden="true" />
      <div className="ui-step-body">
        <span className="ui-step-head">
          <StepName address={address} title={title} />
          {facts === undefined ? null : <span className="ui-step-facts">{facts}</span>}
          {trailing === undefined ? null : <span className="ui-step-trailing">{trailing}</span>}
        </span>
        {children === undefined || children === null || children === false ? null : (
          <div className="ui-step-under">{children}</div>
        )}
      </div>
    </div>
  );
}
