import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useHome } from "../../hooks/useHome.ts";
import { AnsweredDecision } from "../decisions/AnsweredDecision.tsx";
import { useOpQuery } from "../../hooks/useOp.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { HeldDecision } from "../decisions/HeldDecision.tsx";
import { Loaded } from "../ui/Loaded.tsx";

function OpenDecision({ decision, waitsFor }: { decision: Decision; waitsFor: readonly string[] }) {
  const queue = useOpQuery(contracts.decisionQueue, { query: `ref:${decision.ref}` });
  const choices = useChoices();
  const h = useHome();
  const [card] = queue.data ?? [];
  // While its answer waits with Undo, its keys stand down, so a second key press cannot send a second answer.
  const waiting = choices.pending.some((choice) => choice.state === "pending" && choice.ref === decision.ref);
  const line = decision.line === null ? null : h.lineOf(decision.line);
  return (
    <Loaded
      loaded={queue.data !== undefined}
      error={queue.error}
      what="the question"
      onRetry={() => void queue.refetch()}
      at={queue.dataUpdatedAt}
    >
      {card === undefined ? (
        <HeldDecision
          decision={decision}
          waitsFor={waitsFor}
          line={waitsFor.length > 0 ? null : line}
          onWithdraw={() =>
            choices.make(
              contracts.decisionWithdraw.name,
              { ref: decision.ref },
              `Withdrawing ${decision.ref}`,
            )
          }
        />
      ) : (
        // The panel's head already carries its title.
        <DecisionCardItem card={card} active armed={!waiting} titled={false} />
      )}
    </Loaded>
  );
}

function ClosedDecision({ decision }: { decision: Decision }) {
  const choices = useChoices();
  return (
    <AnsweredDecision
      decision={decision}
      onChange={() =>
        choices.make(
          contracts.decisionReopen.name,
          { ref: decision.ref },
          `Reopening ${decision.ref} to change its answer`,
        )
      }
    />
  );
}

/** A question opened by its ref: answered here while it is in the queue, else read only, with how it was settled. */
export function DecisionPanel({
  decision,
  waitsFor,
}: {
  decision: Decision;
  /** Open work that blocks it: a task whose outcome would settle it, which it waits behind. */
  waitsFor: readonly string[];
}) {
  return decision.status === "open" ? (
    <OpenDecision decision={decision} waitsFor={waitsFor} />
  ) : (
    <ClosedDecision decision={decision} />
  );
}
