import { contracts } from "@octotrack/core/contracts";
import { Link } from "../ui/Link.tsx";
import type { Decision } from "@octotrack/core/schemas";
import { useChoices } from "../../hooks/useChoices.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { humanize, whenText } from "../../lib/format.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { DecisionMeta } from "../decisions/DecisionMeta.tsx";
import { HeldDecision } from "../decisions/HeldDecision.tsx";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Pairs, Stack } from "../ui/Pairs.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { DecisionOptions } from "./DecisionOptions.tsx";

function OpenDecision({ decision, waitsFor }: { decision: Decision; waitsFor: readonly string[] }) {
  const queue = useOpQuery(contracts.decisionQueue, { query: `ref:${decision.ref}` });
  const choices = useChoices();
  const [card] = queue.data ?? [];
  // While its answer waits with Undo, its keys stand down, so a second key press cannot send a second answer.
  const waiting = choices.pending.some((choice) => choice.state === "pending" && choice.ref === decision.ref);
  return (
    <Stack>
      {/* The decision being inspected is the one the keys answer. Home stands down while this is open. */}
      <Loaded
        loaded={queue.data !== undefined}
        error={queue.error}
        what="the question"
        onRetry={() => void queue.refetch()}
        at={queue.dataUpdatedAt}
      >
        {card === undefined ? (
          <HeldDecision decision={decision} waitsFor={waitsFor} />
        ) : (
          <DecisionCardItem card={card} active armed={!waiting} />
        )}
      </Loaded>
      <Actions>
        <Button
          onClick={() =>
            choices.make(
              contracts.decisionWithdraw.name,
              { ref: decision.ref },
              `Withdrawing ${decision.ref}`,
            )
          }
        >
          Withdraw
        </Button>
      </Actions>
    </Stack>
  );
}

function ClosedDecision({ decision }: { decision: Decision }) {
  const choices = useChoices();
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  return (
    <Stack>
      <DecisionMeta decision={decision} />
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      <Pairs
        pairs={[
          ["Outcome", chosen?.label],
          ["Note", decision.resolutionNote],
          ["Decided by", decision.decidedBy],
          [
            "When",
            decision.decidedAt === null ? null : whenText(decision.decidedAt).replace(/^(at|on) /, ""),
          ],
          ["How", decision.channel === null ? null : humanize(decision.channel)],
          [
            "Source",
            decision.sourceUrl === null ? null : (
              <Link key="source" href={decision.sourceUrl} external>
                {decision.sourceUrl}
              </Link>
            ),
          ],
          [
            "Superseded by",
            decision.supersededBy === null ? null : (
              <RefLink key="superseded" value={decision.supersededBy} />
            ),
          ],
        ]}
      />
      <DecisionOptions options={decision.options} marked={decision.chosenOption} mark="chosen" />
      <Actions>
        {/* The new answer replaces the old: if the old one was carried out, the owner reverts or adapts. */}
        <Button
          onClick={() =>
            choices.make(
              contracts.decisionReopen.name,
              { ref: decision.ref },
              `Reopening ${decision.ref} to change its answer`,
            )
          }
        >
          {decision.status === "decided" ? "Change answer" : "Reopen"}
        </Button>
      </Actions>
    </Stack>
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
