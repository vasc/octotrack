import type { DecisionCard } from "@octotrack/core/schemas";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { sinceText } from "../../lib/format.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/**
 * What a question is, in a row of small facts: Question, Later or Urgent with its reason in its tone, its line when
 * urgent, its ref, who asked, and how long ago; put off, when.
 */
export function QuestionStrip({
  card,
  line,
  now,
}: {
  card: DecisionCard;
  line: LinePlace | null;
  now?: number;
}) {
  const { decision } = card;
  return (
    <Facts>
      {decision.urgentReason !== null ? (
        <Kind tone="stuck">{URGENT_REASON[decision.urgentReason]}</Kind>
      ) : decision.postponedAt !== null ? (
        <Kind tone="none">Later</Kind>
      ) : (
        <Kind>Question</Kind>
      )}
      {decision.urgentReason !== null && line !== null
        ? `${line.number === null ? "" : `${line.number} · `}${line.title}`
        : null}
      <RefLink value={decision.ref} />
      {decision.postponedAt === null
        ? `asked by ${decision.requestedBy}`
        : `put off ${sinceText(decision.postponedAt, now)}`}
      {decision.postponedAt === null ? (
        <TimeAgo iso={decision.createdAt} {...(now === undefined ? {} : { now })} />
      ) : null}
    </Facts>
  );
}
