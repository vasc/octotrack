import type { Drift } from "@octotrack/core/schemas";
import { useState } from "react";
import { driftTitle } from "../../lib/format.ts";
import { Actions } from "../ui/Actions.tsx";
import { StatusBadge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Field } from "../ui/Field.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { RefLink } from "../ui/RefLink.tsx";
import { RefText } from "../ui/RefText.tsx";
import { Row } from "../ui/Row.tsx";
import { TimeAgo } from "../ui/TimeAgo.tsx";

export type DriftMode = "updated" | "verified";

export interface DriftItemProps {
  drift: Drift;
  error?: string | null;
  onAck(ref: string, mode: DriftMode, note: string): void;
}

/** Something out of date. It only goes away with an explanation, whichever way it is cleared. */
export function DriftItem({ drift, error = null, onAck }: DriftItemProps) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  return (
    <Row
      label={drift.ref}
      title={driftTitle(drift.rule, drift.target)}
      facts={
        <Facts>
          <RefLink value={drift.ref} />
          {drift.status === "open" ? null : <StatusBadge value={drift.status} />}
          <On target={drift.target} />
          {drift.assignee === null ? null : `for ${drift.assignee}`}
          <TimeAgo iso={drift.createdAt} />
        </Facts>
      }
      note={<RefText text={drift.message} />}
    >
      {drift.status === "open" ? (
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
              <Button disabled={trimmed === ""} onClick={() => onAck(drift.ref, "updated", trimmed)}>
                Updated
              </Button>
            ) : null}
            <Button disabled={trimmed === ""} onClick={() => onAck(drift.ref, "verified", trimmed)}>
              Nothing to update
            </Button>
          </Actions>
          {error === null ? null : <Note error>{error}</Note>}
        </>
      ) : drift.note === null ? null : (
        <Note>{drift.resolvedBy === null ? drift.note : `${drift.resolvedBy}: ${drift.note}`}</Note>
      )}
    </Row>
  );
}

/** What the drift is about, openable. */
function On({ target }: { target: string }) {
  return (
    <>
      on <RefLink value={target} />
    </>
  );
}
