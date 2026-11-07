import type { Decision } from "@octotrack/core/schemas";
import { openEntity } from "../../lib/router.ts";
import { humanize } from "../../lib/format.ts";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { DeliveryBadge } from "./DeliveryBadge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

function outcome(decision: Decision): string | null {
  if (decision.status !== "decided") return null;
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  return chosen?.label ?? decision.resolutionNote;
}

export function DecisionRow({ decision }: { decision: Decision }) {
  const result = outcome(decision);
  return (
    <div className="row">
      <RefLink value={decision.ref} />
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(decision.ref)}>
          {decision.title}
        </button>
        {result === null ? null : (
          <div className="row-sub">
            <span>{result}</span>
            {decision.channel === null ? null : <span>via {humanize(decision.channel)}</span>}
          </div>
        )}
        {decision.reportNote === null ? null : <div className="row-sub">{decision.reportNote}</div>}
        {decision.wakeError === null ? null : (
          <div className="row-sub">Wake failed: {decision.wakeError}</div>
        )}
      </div>
      <Badge>{decision.kind}</Badge>
      <StatusBadge value={decision.status} />
      <DeliveryBadge decision={decision} />
      <TimeAgo iso={decision.decidedAt ?? decision.updatedAt} />
    </div>
  );
}
