import type { DecisionCard } from "@octotrack/core/schemas";
import { Badge } from "../ui/Badge.tsx";
import { RefLink } from "../ui/RefLink.tsx";

export interface QueueRestProps {
  card: DecisionCard;
  onOpen(ref: string): void;
}

/** A closed decision: one line, so that the queue does not push the feed off the screen. */
export function QueueRest({ card, onOpen }: QueueRestProps) {
  const { decision, reasons } = card;
  return (
    <div className="queue-more">
      <RefLink value={decision.ref} />
      <button type="button" className="queue-more-title" onClick={() => onOpen(decision.ref)}>
        {decision.title}
      </button>
      {reasons.slice(0, 1).map((reason) => (
        <Badge key={reason} tone="attention">
          {reason}
        </Badge>
      ))}
    </div>
  );
}
