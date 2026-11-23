import type { Decision, Line } from "@octotrack/core/schemas";
import { humanize } from "../../lib/format.ts";
import { openEntity } from "../../lib/router.ts";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { DecisionMeta } from "./DecisionMeta.tsx";

/** Why it is held, in a sentence that says what to do: the task it waits for, or the line that must start. */
function heldSentence(
  waitsFor: readonly string[],
  line: Pick<Line, "ref" | "title" | "state"> | null,
): string {
  if (waitsFor.length > 0) {
    return `Held until ${waitsFor.join(", ")} ${waitsFor.length === 1 ? "is" : "are"} done: its outcome may settle this.`;
  }
  if (line !== null) {
    return `Held until ${line.ref} ${line.title} starts. It is ${humanize(line.state)}; start it to answer this.`;
  }
  return "Held: it is not in your queue yet.";
}

/**
 * An open question that is not in the developer's queue, opened by its ref: why it is held and what to do, then Open
 * its line and Withdraw. It cannot be answered until it reaches the queue, so its options are not drawn.
 */
export function HeldDecision({
  decision,
  waitsFor,
  line,
  onWithdraw,
}: {
  decision: Decision;
  waitsFor: readonly string[];
  /** The line it waits on, when it waits for its line to start. */
  line: Pick<Line, "ref" | "title" | "state"> | null;
  onWithdraw(): void;
}) {
  return (
    <>
      <DecisionMeta decision={decision} state="Held" />
      <Note>{heldSentence(waitsFor, line)}</Note>
      {decision.context === "" ? null : <Markdown text={decision.context} />}
      <Actions>
        {line === null ? null : <Button onClick={() => openEntity(line.ref)}>Open {line.ref}</Button>}
        <Button onClick={onWithdraw}>Withdraw</Button>
      </Actions>
    </>
  );
}
