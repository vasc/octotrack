import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Section } from "../ui/Section.tsx";
import { TextBox } from "../ui/TextBox.tsx";

export interface TellBoxProps {
  line: string;
  /** Who a Tell reaches now: the line's owner, or nobody yet, in which case it waits for whoever takes the line. */
  to: string | null;
  words: string;
  onWords(words: string): void;
  onSend(words: string): void;
  /** Opened with t: the box takes the cursor. */
  focus?: boolean;
  /** Its words are waiting with Undo: they are not sent again. */
  sending?: boolean;
}

/** Tell: a free message to whoever owns the line, closing nothing. Empty, it is a nudge. Cmd+Enter sends it. */
export function TellBox({ line, to, words, onWords, onSend, focus = false, sending = false }: TellBoxProps) {
  const send = () => {
    if (!sending) onSend(words.trim());
  };
  const who = to ?? `whoever takes ${line}`;
  return (
    <Section title={`Tell ${who}`}>
      <TextBox
        label={`Message to ${who}`}
        value={words}
        onChange={onWords}
        onSubmit={send}
        autoFocus={focus}
      />
      <Actions>
        <Button variant="primary" disabled={sending} onClick={send}>
          {sending ? "Sending" : words.trim() === "" ? "Nudge" : "Tell"}
        </Button>
      </Actions>
    </Section>
  );
}
