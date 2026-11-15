import type { Decision } from "@octotrack/core/schemas";
import { Facts } from "../ui/Facts.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/** What a question is, in small facts: its ref, its kind, its priority when it is not the usual, its repo, who asked. */
export function DecisionMeta({ decision }: { decision: Decision }) {
  return (
    <Facts>
      <RefLink value={decision.ref} />
      {decision.kind}
      {decision.priority === "medium" || decision.priority === "none" ? null : decision.priority}
      {decision.project}
      {`asked by ${decision.requestedBy}`}
      <TimeAgo iso={decision.createdAt} />
    </Facts>
  );
}
