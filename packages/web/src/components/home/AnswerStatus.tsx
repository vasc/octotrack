import type { LineHome } from "@octotrack/core/schemas";
import { timeAgo } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { RefLink } from "../ui/RefLink.tsx";

type Answer = LineHome["answers"][number];

function status(answer: Answer): string {
  switch (answer.status) {
    case "not_picked_up":
      return "not picked up yet";
    case "picked_up":
      return answer.by === null
        ? "picked up"
        : `picked up by ${answer.by}${answer.at === null ? "" : `, ${timeAgo(answer.at)}`}`;
    case "carried_out":
      return answer.note === null ? "✓ carried out" : `✓ carried out: ${answer.note}`;
    case "wake_failed":
      return `${answer.unwoken ?? "its agent"} could not be woken; finding an owner`;
  }
}

/**
 * One answer given on a line lately, and what became of it, in one sentence as E-States writes it; Change answer…
 * opens the question, which reopens it and sends the new answer as replacing the old.
 */
export function AnswerStatus({ answer }: { answer: Answer }) {
  return (
    <p className="line-answer" data-status={answer.status}>
      <span className="line-answer-text">
        <RefLink value={answer.ref} /> answered: {answer.answer} · {status(answer)}
      </span>
      <button
        type="button"
        className="more-link"
        aria-label={`Change answer… ${answer.ref}`}
        onClick={() => openEntity(answer.ref)}
      >
        Change answer…
      </button>
    </p>
  );
}
