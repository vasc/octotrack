import type { Decision } from "@octotrack/core/schemas";
import { Badge, StatusBadge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export function DecisionMeta({ decision }: { decision: Decision }) {
  return (
    <div className="decision-top">
      <RefLink value={decision.ref} />
      <Badge tone={decision.kind === "architecture" || decision.kind === "product" ? "info" : "neutral"}>
        {decision.kind}
      </Badge>
      {decision.priority === "medium" || decision.priority === "none" ? null : (
        <StatusBadge value={decision.priority} />
      )}
      {decision.project === null ? null : <span>{decision.project}</span>}
      <span>asked by {decision.requestedBy}</span>
      <TimeAgo iso={decision.createdAt} />
    </div>
  );
}
