import { useState } from "react";
import { Markdown } from "../ui/Markdown.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface LineProposalCardProps {
  kind: "done" | "done_when";
  line: string;
  title: string;
  text: string;
  by: string | null;
  /** Done, or Accept the new done when. */
  onAccept(): void;
  /** Not yet, with what is missing; or Keep the one there is. */
  onDecline(why: string): void;
}

/**
 * An agent's proposal about the line itself, opened: that it is done, with how done when was met, or a new done when.
 * The developer accepts, or turns it down; Not yet asks what is missing, for the owner.
 */
export function LineProposalCard({
  kind,
  line,
  title,
  text,
  by,
  onAccept,
  onDecline,
}: LineProposalCardProps) {
  const [why, setWhy] = useState<string | null>(null);
  const done = kind === "done";
  return (
    <article className="task" aria-label={done ? `${title} is done?` : `New done when for ${title}`}>
      <p className="for-you-kind">
        {done ? "Proposed done" : "Proposed done when"} · {line}
        {by === null ? "" : ` · by ${by}`}
      </p>
      <div className="decision-context">
        <Markdown text={text} />
      </div>
      {why === null ? (
        <div className="decision-actions">
          <button type="button" className="btn" data-primary="true" data-choice="1" onClick={onAccept}>
            {done ? "It is done" : "Accept"}
          </button>
          <button
            type="button"
            className="btn"
            data-choice="2"
            onClick={() => (done ? setWhy("") : onDecline(""))}
          >
            {done ? "Not yet…" : "Keep the one there is"}
          </button>
        </div>
      ) : (
        <form
          className="decision-actions"
          onSubmit={(event) => {
            event.preventDefault();
            onDecline(why.trim());
            setWhy(null);
          }}
        >
          <TextBox
            label={`What ${line} still needs`}
            placeholder="What is missing"
            value={why}
            onChange={setWhy}
          />
          <button type="submit" className="btn" data-primary="true">
            Not yet
          </button>
          <button type="button" className="btn" onClick={() => setWhy(null)}>
            Cancel
          </button>
        </form>
      )}
    </article>
  );
}
