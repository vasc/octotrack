import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";

/** A done when an agent sharpened while the line waited: the new one, the old and why, then Accept or Keep current. */
export function DoneWhenChanged({
  was,
  proposal,
  why,
  numbers,
  onAnswer,
}: {
  was: string;
  proposal: string;
  why: string | null;
  /** The numbers its two choices are drawn with, in the sheet's one run. */
  numbers: readonly [string, string];
  onAnswer(accept: boolean): void;
}) {
  return (
    <Item label="Done when changed" kind="Done when changed" title={<Markdown text={proposal} inline />}>
      <Note>
        Was: <Markdown text={was} inline />
        {why === null ? null : (
          <>
            {" · "}
            <Markdown text={why} inline />
          </>
        )}
      </Note>
      <Actions>
        <Button choice={numbers[0]} onClick={() => onAnswer(true)}>
          Accept
        </Button>
        <Button choice={numbers[1]} onClick={() => onAnswer(false)}>
          Keep current
        </Button>
      </Actions>
    </Item>
  );
}
