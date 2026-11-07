import { contracts } from "@octotrack/core/contracts";
import type { Decision } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { useOpMutation, useOpQuery } from "../../hooks/useOp.ts";
import { DecisionCardItem } from "../decisions/DecisionCardItem.tsx";
import { DecisionMeta } from "../decisions/DecisionMeta.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { KeyValues } from "./KeyValues.tsx";

function OpenDecision({ decision }: { decision: Decision }) {
  const queue = useOpQuery(contracts.decisionQueue, { query: `ref:${decision.ref}` });
  const withdraw = useOpMutation(contracts.decisionWithdraw);
  const [card] = queue.data ?? [];
  return (
    <>
      {/* The decision being inspected is the one the keys answer. The queue stands down while this is open. */}
      {card === undefined ? null : <DecisionCardItem card={card} active />}
      <div>
        <button type="button" className="btn" onClick={() => withdraw.mutate({ ref: decision.ref })}>
          Withdraw
        </button>
      </div>
    </>
  );
}

function ClosedDecision({ decision }: { decision: Decision }) {
  const reopen = useOpMutation(contracts.decisionReopen);
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  return (
    <>
      <DecisionMeta decision={decision} />
      {decision.context === "" ? null : <p className="prose">{decision.context}</p>}
      <KeyValues
        items={[
          ["Outcome", chosen?.label],
          ["Note", decision.resolutionNote],
          ["Decided by", decision.decidedBy],
          ["When", decision.decidedAt?.slice(0, 16).replace("T", " ")],
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
        <button type="button" className="btn" onClick={() => reopen.mutate({ ref: decision.ref })}>
          Reopen
        </button>
      </div>
    </>
  );
}

export function DecisionPanel({ decision }: { decision: Decision }) {
  return decision.status === "open" ? (
    <OpenDecision decision={decision} />
  ) : (
    <ClosedDecision decision={decision} />
  );
}
