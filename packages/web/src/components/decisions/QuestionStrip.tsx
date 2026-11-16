import type { DecisionCard } from "@octotrack/core/schemas";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { Kind } from "../ui/Item.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

/**
 * What a question is, in a row of small facts: Question, Later or Urgent with its reason in its tone, its line when
 * urgent, its ref, who asked or what it holds up, and how long ago it was asked.
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
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  return (
    <Facts>
      {decision.urgentReason !== null ? (
        <Kind tone="stuck">Urgent · {URGENT_REASON[decision.urgentReason]}</Kind>
      ) : decision.postponedAt !== null ? (
        <Kind tone="none">Later</Kind>
      ) : (
        <Kind>Question</Kind>
      )}
      {decision.urgentReason !== null && line !== null
        ? `${line.number === null ? "" : `${line.number} · `}${line.title}`
        : null}
      <RefLink value={decision.ref} />
      {openWork.length === 0 ? (
        `asked by ${decision.requestedBy}`
      ) : (
        <>
          holds up{" "}
          {openWork.map((item) => (
            <RefLink key={item.ref} value={item.ref} />
          ))}
        </>
      )}
      {card.reasons}
      <TimeAgo iso={decision.createdAt} {...(now === undefined ? {} : { now })} />
    </Facts>
  );
}
