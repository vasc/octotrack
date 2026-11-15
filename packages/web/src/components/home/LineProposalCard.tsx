import type { ForYou } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Stack } from "../ui/Pairs.tsx";
import { TextBox } from "../ui/TextBox.tsx";

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
 * An agent's proposal about the line itself, opened, as E-States draws it: that it is done, with the done when it meets
 * and the agent's case; or a changed done when, quoting the old and the new, with why. 1 accepts; 2 turns it down, and
 * Not yet asks what is missing, for the owner.
 */
export function LineProposalCard({ proposal, title, onAccept, onDecline }: LineProposalCardProps) {
  const [why, setWhy] = useState<string | null>(null);
  const done = proposal.kind === "done";
  return (
    <Item
      label={done ? `${title} is done?` : `New done when for ${title}`}
      kind={`${done ? "Proposed as done" : "Done when changed"}${proposal.by === null ? "" : ` · ${proposal.by}`}`}
      title={<Markdown text={proposal.kind === "done" ? proposal.doneWhen : proposal.text} inline />}
    >
      {proposal.kind === "done" ? (
        <Markdown text={proposal.text} />
      ) : (
        <Note>
          Was: <Markdown text={proposal.was} inline />
          {proposal.why === null ? null : (
            <>
              {" · "}
              <Markdown text={proposal.why} inline />
            </>
          )}
        </Note>
      )}
      {why === null ? (
        <Actions>
          <Button variant="primary" choice={1} onClick={onAccept}>
            {done ? "Done" : "Accept"}
          </Button>
          <Button choice={2} onClick={() => (done ? setWhy("") : onDecline(""))}>
            {done ? "Not yet" : "Keep current"}
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
            <TextBox
              label={`What ${proposal.line} still needs`}
              placeholder="What is missing"
              value={why}
              onChange={setWhy}
              autoFocus
            />
            <Actions>
              <Button type="submit" variant="primary">
                Not yet
              </Button>
              <Button variant="quiet" onClick={() => setWhy(null)}>
                Cancel
              </Button>
            </Actions>
          </Stack>
        </form>
      )}
    </Item>
  );
}
