import type { Line, StepInKind } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { STEP_IN_ACTIONS } from "../../lib/lines.ts";
import { StepIn } from "./StepIn.tsx";

/** A working line's Step in, when the server says why it needs one: its reason and the action that fits it. */
export function LineStepIn({
  line,
  reason,
  kind,
  focused,
  h,
}: {
  line: Line;
  /** The server's reason, by the rule that raises Step in; null when none is needed. */
  reason: string | null;
  kind: StepInKind | null;
  focused: boolean;
  h: HomeActions;
}) {
  if (reason === null || kind === null) return null;
  const action = STEP_IN_ACTIONS[kind];
  const repo = line.repos[0];
  return (
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
      busy={h.held.has(line.ref)}
    />
  );
}
