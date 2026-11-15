import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { humanize, whenText } from "../../lib/format.ts";
import { useChoices } from "../../hooks/useChoices.ts";
import { useOpQuery } from "../../hooks/useOp.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { DecisionMeta } from "../decisions/DecisionMeta.tsx";
import { HeldDecision } from "../decisions/HeldDecision.tsx";
import { Loaded } from "../ui/Loaded.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { KeyValues } from "./KeyValues.tsx";
import { Markdown } from "../ui/Markdown.tsx";

function OpenDecision({ decision, waitsFor }: { decision: Decision; waitsFor: readonly string[] }) {
  const queue = useOpQuery(contracts.decisionQueue, { query: `ref:${decision.ref}` });
  const choices = useChoices();
  const [card] = queue.data ?? [];
  // While its answer waits with Undo, its keys stand down, so a second key press cannot send a second answer.
  const waiting = choices.pending.some((choice) => choice.state === "pending" && choice.ref === decision.ref);
  return (
    <>
      {/* The decision being inspected is the one the keys answer. Home stands down while this is open. */}
      <Loaded loaded={queue.data !== undefined} error={queue.error} label="Loading the question">
        {card === undefined ? (
          <HeldDecision decision={decision} waitsFor={waitsFor} />
        ) : (
          <DecisionCardItem card={card} active armed={!waiting} />
        )}
      </Loaded>
      <div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            choices.make(
              contracts.decisionWithdraw.name,
              { ref: decision.ref },
              `Withdrawing ${decision.ref}`,
            )
          }
        >
          Withdraw
        </button>
      </div>
    </>
  );
}

function ClosedDecision({ decision }: { decision: Decision }) {
  const choices = useChoices();
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  return (
    <>
      <DecisionMeta decision={decision} />
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      <KeyValues
        items={[
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
              <a key="source" href={decision.sourceUrl} target="_blank" rel="noreferrer">
                {decision.sourceUrl}
              </a>
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
      {decision.options.length === 0 ? null : (
        <KeyValues
          items={decision.options.map((option) => [
            option.key === decision.chosenOption ? `${option.key} (chosen)` : option.key,
            option.description === "" ? option.label : `${option.label}: ${option.description}`,
          ])}
        />
      )}
      <div>
        {/* The new answer replaces the old: if the old one was carried out, the owner reverts or adapts. */}
        <button
          type="button"
          className="btn"
          onClick={() =>
            choices.make(
              contracts.decisionReopen.name,
              { ref: decision.ref },
              `Reopening ${decision.ref} to change its answer`,
            )
          }
        >
          {decision.status === "decided" ? "Change answer" : "Reopen"}
        </button>
      </div>
    </>
  );
}

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
