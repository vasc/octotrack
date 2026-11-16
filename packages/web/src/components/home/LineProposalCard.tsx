import type { ForYou } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Item } from "../ui/Item.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Columns, Stack } from "../ui/Pairs.tsx";

export type LineProposal = Extract<ForYou, { kind: "done" | "done_when" }>;

export interface LineProposalCardProps {
  proposal: LineProposal;
  /** The line's title, for its name. */
  title: string;
  /** Done, or Accept the new done when. */
  onAccept(): void;
  /** Not yet, with what is missing; or Keep current. */
  onDecline(why: string): void;
}

/**
 * An agent's proposal about the line itself, opened, titled by the line: that it is done, with the done when it meets
 * and its case, each labelled; or a changed done when, the old and the new side by side, with why. 1 accepts; 2 turns
 * it down, and Not yet… asks what is still needed, for the owner, before it is sent.
 */
export function LineProposalCard({ proposal, title, onAccept, onDecline }: LineProposalCardProps) {
  // What is still needed is typed in this card alone, so it is the component's own state.
  const [why, setWhy] = useState<string | null>(null);
  const done = proposal.kind === "done";
  const answer =
    why === null ? (
      <Actions>
        <Button variant="primary" choice={1} onClick={onAccept}>
          {done ? "Done" : "Accept"}
        </Button>
        <Button choice={2} onClick={() => (done ? setWhy("") : onDecline(""))}>
          {done ? "Not yet…" : "Keep current"}
        </Button>
      </Actions>
    ) : (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onDecline(why.trim());
          setWhy(null);
        }}
      >
        <Stack>
          <Field label="What it still needs" value={why} onChange={setWhy} multiline autoFocus />
          <Actions>
            <Button type="submit" variant="primary" disabled={why.trim() === ""}>
              Send
            </Button>
            <Button onClick={() => setWhy(null)}>Back</Button>
          </Actions>
        </Stack>
      </form>
    );
  return (
    <Item
      label={done ? `${title} is done?` : `New done when for ${title}`}
      kind={`${done ? "Proposed as done" : "Done when changed"}${proposal.by === null ? "" : ` · by ${proposal.by}`}`}
      title={title}
      answer={answer}
    >
      {proposal.kind === "done" ? (
        <>
          <Labelled label="Done when">
            <Markdown text={proposal.doneWhen} inline />
          </Labelled>
          <Labelled label="Its case">
            <Markdown text={proposal.text} inline />
          </Labelled>
        </>
      ) : (
        <>
          <Columns>
            <Labelled label="Was">
              <Markdown text={proposal.was} inline />
            </Labelled>
            <Labelled label="Proposed">
              <Markdown text={proposal.text} inline />
            </Labelled>
          </Columns>
          {proposal.why === null ? null : (
            <Note>
              <b>Why:</b> <Markdown text={proposal.why} inline />
            </Note>
          )}
        </>
      )}
    </Item>
  );
}
