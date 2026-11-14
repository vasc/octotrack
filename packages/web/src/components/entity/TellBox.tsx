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

/** Tell: a free message to whoever owns the line, closing nothing. Empty, it is a nudge. */
export function TellBox({ line, to, words, onWords, onSend, focus = false, sending = false }: TellBoxProps) {
  const send = () => {
    if (!sending) onSend(words.trim());
  };
  const who = to ?? `whoever takes ${line}`;
  return (
    <section className="panel-section" aria-label="Tell">
      <h2 className="panel-label">Tell {who}</h2>
      <form
        className="tell-box"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <TextBox label={`Tell ${who}`} value={words} onChange={onWords} onSubmit={send} autoFocus={focus} />
        <div className="tell-foot">
          <span className="muted">
            A message, not an answer: it closes nothing. Markdown works; the box grows as you type. It goes to
            the line's inbox and wakes the owner; empty, it is a nudge.
          </span>
          <button type="submit" className="btn" data-primary="true" disabled={sending}>
            {sending ? "Sending" : words.trim() === "" ? "Nudge" : "Tell"}
          </button>
        </div>
      </form>
    </section>
  );
}
