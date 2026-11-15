import type { DecisionCard } from "@octotrack/core/schemas";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Facts } from "../ui/Facts.tsx";
import { RefLink } from "../ui/RefLink.tsx";

/** What a question is, in a row of small facts: Question or Urgent with its reason, its line, its ref, who asked. */
export function QuestionStrip({ card, line }: { card: DecisionCard; line: LinePlace | null }) {
  const { decision } = card;
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  return (
    <Facts>
      {decision.urgentReason === null ? "Question" : `Urgent · ${URGENT_REASON[decision.urgentReason]}`}
      {decision.urgentReason !== null && line !== null
        ? `${line.number === null ? "" : `${line.number} · `}${line.title}`
        : null}
      <RefLink value={decision.ref} />
      {decision.urgentReason !== null ? null : openWork.length === 0 ? (
        `asked by ${decision.requestedBy}`
      ) : (
        <>
          holds up{" "}
          {openWork.map((item) => (
            <RefLink key={item.ref} value={item.ref} />
          ))}
        </>
      )}
      {decision.postponedAt === null ? null : "later"}
      {card.reasons}
    </Facts>
  );
}
