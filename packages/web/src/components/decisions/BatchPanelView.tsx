import type { DecisionLine } from "@octotrack/core/decision-lines";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { List } from "../ui/List.tsx";
import { Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { Sheet } from "../ui/Sheet.tsx";

export interface BatchResultLine {
  ref: string;
  ok: boolean;
  error: string | null;
}

export interface BatchPanelViewProps {
  text: string;
  parsed: readonly DecisionLine[];
  parseError: string | null;
  /** What the tracker says to do about a failed record, when it said. */
  hint?: string | null;
  results: readonly BatchResultLine[] | null;
  submitting: boolean;
  onChange(text: string): void;
  onSubmit(): void;
  onClose(): void;
  /** Opened with a key: the box takes the cursor. */
  autoFocus?: boolean;
  /** How many times recording replaced the lines with those that failed, which the box shows even with focus. */
  recorded?: number;
}

/** Answers given elsewhere, one per row, typed as fast as they come back to mind: ref, option, an optional note. */
export function BatchPanelView(props: BatchPanelViewProps) {
  const {
    text,
    parsed,
    parseError,
    hint = null,
    results,
    submitting,
    onChange,
    onSubmit,
    onClose,
    autoFocus = false,
    recorded = 0,
  } = props;
  const ready = parsed.length > 0 && parseError === null && !submitting;
  // Which row stops it, as the parser names it, said beside the disabled Record.
  const fixRow = parseError === null ? null : (/^Row (\d+)/.exec(parseError)?.[1] ?? null);
  return (
    <Sheet
      title="Record answers"
      onClose={onClose}
      actions={
        <Actions>
          <Button
            variant="primary"
            disabled={!ready}
            busy={submitting ? "Recording…" : undefined}
            onClick={onSubmit}
          >
            Record {parsed.length === 0 ? "" : parsed.length}
          </Button>
          {fixRow === null ? null : <Note>Fix row {fixRow} first</Note>}
        </Actions>
      }
    >
      <Field
        label="One per row: the question, the option, a note if you like"
        multiline
        autoFocus={autoFocus}
        replaced={recorded}
        placeholder={"D-3 redis Agreed on the call\nD-4 a\nD-5 - None of the options, doing this instead"}
        value={text}
        onChange={onChange}
        onSubmit={() => {
          if (ready) onSubmit();
        }}
      />
      {parseError === null ? null : (
        <Note error hint={hint}>
          {parseError}
        </Note>
      )}
      {results === null ? null : (
        <List label="Results">
          {results.map((result) => (
            <Row
              key={result.ref}
              kind={<RefLink value={result.ref} />}
              tone={result.ok ? "none" : "stuck"}
              title={result.ok ? "✓ recorded" : `✗ ${result.error ?? "not recorded"}`}
            />
          ))}
        </List>
      )}
    </Sheet>
  );
}
