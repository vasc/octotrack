import type { Line, LineStart, RunnerStatus } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { stepInRef } from "../../lib/focus.ts";
import { stepInReason } from "../../lib/lines.ts";
import { StepIn } from "./StepIn.tsx";

/** A clone that failed says so in its output: the fix is a checkout this machine already has. */
const CLONE_FAILED = /clone|checkout is set/i;

/**
 * A working line's Step in, when the server says it needs one: the choices that can fix what went wrong, or one folded
 * row while the developer is at a place.
 */
export function LineStepIn({
  line,
  start,
  needed,
  runner,
  focused,
  folded,
  h,
  onFocus,
}: {
  line: Line;
  start: LineStart | null;
  /** Whether to step in is the server's rule, shared with the phone's buzz. */
  needed: boolean;
  runner: RunnerStatus;
  focused: boolean;
  /** At a place, Step in folds to a row until it has focus. */
  folded: boolean;
  h: HomeActions;
  onFocus(ref: string): void;
}) {
  const reason = needed ? stepInReason(line, runner, start) : null;
  if (reason === null) return null;
  if (folded && !focused)
    return (
      <div className="line-items">
        <button type="button" className="more-link" onClick={() => onFocus(stepInRef(line.ref))}>
          Step in, folded
        </button>
      </div>
    );
  const failed = start?.state === "failed" || start?.state === "never_took";
  const cloneFailed = failed && CLONE_FAILED.test(start?.output ?? "");
  const atCap = runner.configured && !runner.dryRun && !failed;
  const repo = line.repos[0];
  return (
    <div className="line-items">
      <StepIn
        line={line}
        reason={reason}
        focused={focused}
        {...((failed && !cloneFailed) || !runner.configured ? { onRetry: h.retry } : {})}
        {...(atCap ? { onAnyway: h.anyway } : {})}
        {...(cloneFailed && repo !== undefined ? { checkoutRepo: repo, onCheckout: h.setCheckout } : {})}
        onOwn={h.own}
        onTable={h.table}
      />
    </div>
  );
}
