import type { DecisionCard } from "@octotrack/core/schemas";
import type { LinePlace } from "../../hooks/useLinePlace.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { RefLink } from "../ui/RefLink.tsx";

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The line over a question: Focused when it has focus, what it is (urgent with its reason, and the line it stands apart
 * from), its ref, and what it holds up or who asked.
 */
export function QuestionStrip({
  card,
  selected,
  line,
}: {
  card: DecisionCard;
  selected: boolean;
  line: LinePlace | null;
}) {
  const { decision } = card;
  const openWork = card.blocks.filter((item) => item.status !== "done" && item.status !== "cancelled");
  return (
    <div className="question-strip">
      {selected ? <span className="question-focused">Focused</span> : null}
      {decision.urgentReason === null ? (
        <span className="question-kind">Question</span>
      ) : (
        <>
          <span className="question-kind">Urgent</span>
          <span className="question-kind">{capitalized(URGENT_REASON[decision.urgentReason])}</span>
        </>
      )}
      {decision.urgentReason !== null && line !== null ? (
        <span>
          {line.number === null ? "" : `${line.number} · `}
          {line.title} · <RefLink value={decision.ref} />
        </span>
      ) : (
        <RefLink value={decision.ref} />
      )}
      {decision.urgentReason !== null ? null : openWork.length === 0 ? (
        <span>asked by {decision.requestedBy}</span>
      ) : (
        <span>
          holds up{" "}
          {openWork.map((item) => (
            <RefLink key={item.ref} value={item.ref} />
          ))}
        </span>
      )}
      {decision.postponedAt === null ? null : <span>later</span>}
      {card.reasons.map((reason) => (
        <span key={reason}>{reason}</span>
      ))}
    </div>
  );
}
