import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Section } from "../ui/Section.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface OwnWorkBoxProps {
  line: string;
  words: string;
  onWords(words: string): void;
  onTask(title: string): void;
  onNote(body: string): void;
  /** What was typed is on its way, waiting with Undo: not sent again. */
  sending?: boolean;
}

/** On a line the developer owns, one growing box: what is typed becomes a task of theirs, or a note on the line. */
export function OwnWorkBox({ line, words, onWords, onTask, onNote, sending = false }: OwnWorkBoxProps) {
  const text = words.trim();
  const off = text === "" || sending;
  return (
    <Section title="Add a task or a note">
      <TextBox label={`Add to ${line}`} placeholder="A task, or a note" value={words} onChange={onWords} />
      <Actions>
        <Button disabled={off} onClick={() => onTask(text)}>
          Add as a task
        </Button>
        <Button disabled={off} onClick={() => onNote(text)}>
          Add as a note
        </Button>
      </Actions>
    </Section>
  );
}
