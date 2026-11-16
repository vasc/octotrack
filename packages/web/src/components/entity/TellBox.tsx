import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Stack } from "../ui/Pairs.tsx";

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
  /** Who owns the line is still loading: said, rather than naming nobody and changing. */
  loading?: boolean;
}

/**
 * Tell: a free message to whoever owns the line, closing nothing, under a visible label naming who it reaches. Empty,
 * it is a nudge, and the box says so. Cmd+Enter sends it.
 */
export function TellBox({
  line,
  to,
  words,
  onWords,
  onSend,
  focus = false,
  sending = false,
  loading = false,
}: TellBoxProps) {
  const send = () => {
    if (!sending && !loading) onSend(words.trim());
  };
  const who = loading ? `${line}'s owner` : (to ?? `whoever takes ${line}`);
  return (
    <Stack>
      <Field
        label={`Tell ${who}`}
        placeholder="Leave it empty to nudge"
        value={words}
        onChange={onWords}
        onSubmit={send}
        autoFocus={focus}
        multiline
        {...(loading ? { note: `Loading who owns ${line}…` } : {})}
      />
      <Actions>
        <Button variant="primary" disabled={loading} busy={sending ? "Sending…" : undefined} onClick={send}>
          {words.trim() === "" ? "Nudge" : "Tell"}
        </Button>
      </Actions>
    </Stack>
  );
}
