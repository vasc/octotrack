import type { Decision } from "@octotrack/core/schemas";
import { Link } from "../ui/Link.tsx";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { DecisionMeta } from "./DecisionMeta.tsx";
import type { ReactNode } from "react";
import { Mark } from "../ui/Badge.tsx";

/** What became of an answer: carried out, picked up and not reported yet, or not picked up. */
function thenText(decision: Decision): ReactNode {
  if (decision.reportStatus !== null) {
    const how = decision.reportStatus === "done" ? "Carried out" : "Partly carried out";
    return (
      <>
        <Mark tone="good" icon="check" />
        {decision.reportNote === null ? how : `${how}: ${decision.reportNote}`}
      </>
    );
  }
  if (decision.pickedUpBy !== null)
    return `Picked up by ${decision.pickedUpBy}; not reported as carried out yet`;
  return "Not picked up yet";
}

/** The state a closed question is in, in a word. */
function stateWord(decision: Decision): string {
  if (decision.status === "decided") return "Answered";
  return decision.status.charAt(0).toUpperCase() + decision.status.slice(1);
}

/**
 * A closed question opened by its ref: its state and who answered, "Answer" (the option chosen, or the developer's own
 * words), "Then" (what became of it), and Change answer.
 */
export function AnsweredDecision({ decision, onChange }: { decision: Decision; onChange(): void }) {
  const chosen = decision.options.find((option) => option.key === decision.chosenOption);
  const answer = chosen?.label ?? decision.resolutionNote;
  return (
    <Stack>
      <DecisionMeta decision={decision} state={stateWord(decision)} />
      {answer === null ? null : (
        <Labelled label="Answer">
          <Markdown text={answer} inline />
          {chosen === undefined || decision.resolutionNote === null ? null : (
            <Note>
              <Markdown text={decision.resolutionNote} inline />
            </Note>
          )}
        </Labelled>
      )}
      <Labelled label="Then">{thenText(decision)}</Labelled>
      {decision.supersededBy === null ? null : (
        <Note>
          Superseded by <RefLink value={decision.supersededBy} />
        </Note>
      )}
      {decision.sourceUrl === null ? null : (
        <Note>
          <Link href={decision.sourceUrl} external>
            Where it was decided
          </Link>
        </Note>
      )}
      <Actions>
        {/* The new answer replaces the old: if the old one was carried out, the owner reverts or adapts. */}
        <Button onClick={onChange}>{decision.status === "decided" ? "Change answer" : "Reopen"}</Button>
      </Actions>
    </Stack>
  );
}
