import type { ForYou } from "@octotrack/core/schemas";
import { useState } from "react";
import { Markdown } from "../ui/Markdown.tsx";
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
    <article className="line-proposal" aria-label={done ? `${title} is done?` : `New done when for ${title}`}>
      <p className="panel-label" data-tone="info">
        {done ? "Proposed as done" : "Done when changed"}
        {proposal.by === null ? "" : ` · ${proposal.by}`}
      </p>
      {proposal.kind === "done" ? (
        <>
          <p className="line-proposal-claim">
            Done when "<Markdown text={proposal.doneWhen} inline />
            ": met.
          </p>
          <div className="summary-text">
            <Markdown text={proposal.text} />
          </div>
        </>
      ) : (
        <p className="line-proposal-claim">
          "<Markdown text={proposal.was} inline />" became "<Markdown text={proposal.text} inline />
          ".
          {proposal.why === null ? null : (
            <>
              {" "}
              Why: <Markdown text={proposal.why} inline />
            </>
          )}
        </p>
      )}
      {why === null ? (
        <div className="question-actions">
          <button type="button" className="btn" data-primary="true" data-choice="1" onClick={onAccept}>
            {done ? "Done" : "Accept"}
          </button>
          <button
            type="button"
            className="btn"
            data-choice="2"
            onClick={() => (done ? setWhy("") : onDecline(""))}
          >
            {done ? "Not yet" : "Keep current"}
          </button>
        </div>
      ) : (
        <form
          className="question-own"
          onSubmit={(event) => {
            event.preventDefault();
            onDecline(why.trim());
            setWhy(null);
          }}
        >
          <TextBox
            label={`What ${proposal.line} still needs`}
            placeholder="What is missing"
            value={why}
            onChange={setWhy}
            autoFocus
          />
          <div className="question-actions">
            <button type="submit" className="btn" data-primary="true">
              Not yet
            </button>
            <button type="button" className="btn" onClick={() => setWhy(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
