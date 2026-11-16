import type { Line, StepInKind } from "@octotrack/core/schemas";
import type { HomeActions } from "../../hooks/useHome.ts";
import { stepInRef } from "../../lib/focus.ts";
import { STEP_IN_ACTIONS, STEP_IN_SHORT } from "../../lib/lines.ts";
import { Row } from "../ui/Row.tsx";
import { StepIn } from "./StepIn.tsx";

/**
 * A working line's Step in, when the server says why it needs one: its reason and the action that fits it; or, while
 * the developer is at a place, one row saying why in a few words, which opens it.
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
  /** The server's reason, by the rule that raises Step in; null when none is needed. */
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
      <Row
        kind="Step in"
        tone="stuck"
        title={STEP_IN_SHORT[kind]}
        onOpen={() => onFocus(stepInRef(line.ref))}
      />
    );
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
