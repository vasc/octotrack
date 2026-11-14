import { useState } from "react";

/** What tabling does, in words: what stays held, and who winds down. */
function consequences(held: { questions: number; tasks: number } | undefined, owner: string | null): string {
  const parts = [
    held === undefined || held.questions === 0
      ? null
      : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held === undefined || held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  const total = (held?.questions ?? 0) + (held?.tasks ?? 0);
  const holds =
    total === 0
      ? "Its drift is held."
      : `Its ${parts.join(" and ")} ${total === 1 ? "is" : "are"} held, and so is its drift.`;
  const winds =
    owner === null
      ? " Agents with it are told to wind down, then their writes are refused until the line comes back."
      : ` ${owner} and any helpers are told to wind down and have 15 minutes to park: a hand-off summary, reports on answers it already took, a branch note. Then its claim ends and its writes are refused until the line comes back.`;
  return holds + winds;
}

/**
 * Tabling a line, as E-States draws it: why it waits, since a tabled line always says why; if wanted, a date to look
 * at it again, when it comes back under Proposed; and what tabling does to what it holds and to its agents.
 */
export function TableForm({
  title,
  held,
  owner = null,
  onTable,
  onCancel,
}: {
  title: string;
  /** What the line holds that waits with it. */
  held?: { questions: number; tasks: number };
  /** Who winds down: its owner, when it has one. */
  owner?: string | null;
  onTable(reason: string, lookAgainAt: string | null): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  const [lookAgain, setLookAgain] = useState("");
  return (
    <form
      className="table-form"
      aria-label={`Table ${title}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim() !== "") onTable(reason.trim(), lookAgain === "" ? null : lookAgain);
      }}
    >
      <h3 className="question-title">Table {title}</h3>
      <label className="field-label">
        <span>Why</span>
        <input
          className="field"
          aria-label={`Why table ${title}`}
          placeholder="Why not now?"
          value={reason}
          // biome-ignore lint/a11y/noAutofocus: the developer chose to table, so the reason comes next
          autoFocus
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="field-label">
        <span>
          Look at it again on <span className="muted">optional</span>
        </span>
        <input
          className="field"
          type="date"
          aria-label="Look again on"
          value={lookAgain}
          onChange={(event) => setLookAgain(event.target.value)}
        />
      </label>
      <p className="muted">{consequences(held, owner)}</p>
      {lookAgain === "" ? null : (
        <p className="muted">
          On {lookAgain} it comes back under Proposed, counted in "to accept", with your reason beside it and
          the choices any proposal has.
        </p>
      )}
      <div className="question-actions">
        <button type="submit" className="btn" data-primary="true" disabled={reason.trim() === ""}>
          Table it
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
