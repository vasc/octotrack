import type { Drift } from "@octotrack/core/schemas";
import { useState } from "react";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Field } from "../ui/Field.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";

export type DriftMode = "updated" | "verified";

export interface DriftAnswerProps {
  drift: Drift;
  /** An answer to it waits with Undo: neither button can send another. */
  busy?: boolean;
  onAck(ref: string, mode: DriftMode, note: string): void;
}

/**
 * How something out of date is cleared, only ever with an explanation: what to check, the required note, then Updated
 * and Nothing to update, both off until the note has words. Once cleared, the note it was cleared with.
 */
export function DriftAnswer({ drift, busy = false, onAck }: DriftAnswerProps) {
  // The note is typed here alone, so it is the component's own state.
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  if (drift.status !== "open") {
    return drift.note === null ? null : (
      <Note>{drift.resolvedBy === null ? drift.note : `${drift.resolvedBy}: ${drift.note}`}</Note>
    );
  }
  return (
    <>
      <Markdown text={drift.suggestion} />
      <Field
        label="Note · required: what changed, or why nothing had to"
        value={note}
        onChange={setNote}
        multiline
      />
      <Actions>
        {/* Drift about state clears by itself once the state is right, so "updated" could only be a false claim. */}
        {drift.edge ? (
          <Button
            variant="primary"
            disabled={trimmed === "" || busy}
            onClick={() => onAck(drift.ref, "updated", trimmed)}
          >
            Updated
          </Button>
        ) : null}
        <Button disabled={trimmed === "" || busy} onClick={() => onAck(drift.ref, "verified", trimmed)}>
          Nothing to update
        </Button>
      </Actions>
    </>
  );
}
