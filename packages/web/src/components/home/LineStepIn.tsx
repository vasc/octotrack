import type { Line, StepInKind } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { stepInRef } from "../../lib/focus.ts";
import { STEP_IN_ACTIONS, STEP_IN_SHORT } from "../../lib/lines.ts";
import { StepIn } from "./StepIn.tsx";

/**
 * A working line's Step in, when the server says why it needs one: its reason, the action that fits that reason, or,
 * while the developer is at a place, one folded row saying why in a few words.
 */
export function LineStepIn({
  line,
  reason,
  kind,
  focused,
  folded,
  h,
  onFocus,
}: {
  line: Line;
  /** The server's reason, by the rule that raises Step in, shared with the phone's buzz; null when none is needed. */
  reason: string | null;
  kind: StepInKind | null;
  focused: boolean;
  /** At a place, Step in folds to a row until it has focus. */
  folded: boolean;
  h: HomeActions;
  onFocus(ref: string): void;
}) {
  if (reason === null || kind === null) return null;
  if (folded && !focused)
    return (
      <div className="line-items">
        <button type="button" className="more-link" onClick={() => onFocus(stepInRef(line.ref))}>
          Step in: {STEP_IN_SHORT[kind]}
        </button>
      </div>
    );
  const action = STEP_IN_ACTIONS[kind];
  const repo = line.repos[0];
  return (
    <div className="line-items">
      <StepIn
        line={line}
        reason={reason}
        focused={focused}
        {...(action === "retry" ? { onRetry: h.retry } : {})}
        {...(action === "anyway" ? { onAnyway: h.anyway } : {})}
        {...(action === "checkout" && repo !== undefined
          ? { checkoutRepo: repo, onCheckout: h.setCheckout }
          : {})}
        onOwn={h.own}
        onTable={h.table}
      />
    </div>
  );
}
