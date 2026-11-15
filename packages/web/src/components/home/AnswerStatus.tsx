import type { LineHome } from "@octotrack/core/schemas";
import { timeAgo } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

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

/** One answer given on a line lately and what became of it; Change answer opens the question to answer it again. */
export function AnswerStatus({ answer }: { answer: Answer }) {
  return (
    <Row
      kind={<RefLink value={answer.ref} />}
      tone="none"
      title={answer.answer}
      note={status(answer)}
      trailing={
        <Button
          variant="quiet"
          aria-label={`Change answer ${answer.ref}`}
          onClick={() => openEntity(answer.ref)}
        >
          Change answer
        </Button>
      }
    />
  );
}
