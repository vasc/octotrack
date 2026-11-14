import { TextBox } from "../ui/TextBox.tsx";

export interface TellBoxProps {
  line: string;
  /** Who a Tell reaches now: the line's owner, or nobody yet, in which case it waits for whoever takes the line. */
  to: string | null;
  words: string;
  onWords(words: string): void;
  onSend(words: string): void;
}

/** Tell: a free message to whoever owns the line, closing nothing. Empty, it is a nudge. */
export function TellBox({ line, to, words, onWords, onSend }: TellBoxProps) {
  const send = () => onSend(words.trim());
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <TextBox
        label={`Tell ${to ?? `whoever takes ${line}`}`}
        placeholder={words === "" ? "Empty, it is a nudge" : undefined}
        value={words}
        onChange={onWords}
        onSubmit={send}
      />
      <button type="submit" className="btn">
        {words.trim() === "" ? "Nudge" : "Send"}
      </button>
    </form>
  );
}
