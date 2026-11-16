import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Item } from "../ui/Item.tsx";
import { Labelled } from "../ui/Labelled.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Columns } from "../ui/Pairs.tsx";

/**
 * A done when an agent sharpened while the line waited, in the Start sheet: who changed it, the old and the new side by
 * side, why, then Accept or Keep current.
 */
export function DoneWhenChanged({
  was,
  proposal,
  why,
  by,
  numbers,
  onAnswer,
}: {
  was: string;
  proposal: string;
  why: string | null;
  /** The agent that proposed it, when known. */
  by: string | null;
  /** The numbers its two choices are drawn with, in the sheet's one run. */
  numbers: readonly [string, string];
  onAnswer(accept: boolean): void;
}) {
  return (
    <Item
      label="Done when changed"
      kind={by === null ? "Done when changed" : `Done when changed · by ${by}, while it waited`}
      answer={
        <Actions>
          <Button variant="primary" choice={numbers[0]} onClick={() => onAnswer(true)}>
            Accept
          </Button>
          <Button choice={numbers[1]} onClick={() => onAnswer(false)}>
            Keep current
          </Button>
        </Actions>
      }
    >
      <Columns>
        <Labelled label="Was">
          <Markdown text={was} inline />
        </Labelled>
        <Labelled label="Proposed">
          <Markdown text={proposal} inline />
        </Labelled>
      </Columns>
      {why === null ? null : (
        <Note>
          <b>Why:</b> <Markdown text={why} inline />
        </Note>
      )}
    </Item>
  );
}
