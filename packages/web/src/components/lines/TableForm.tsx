import { useState } from "react";

/**
 * Asks why a line waits before tabling it, since a tabled line always says why, and, if wanted, a date to look at it
 * again, when it comes back under Proposed.
 */
export function TableForm({
  title,
  onTable,
  onCancel,
}: {
  title: string;
  onTable(reason: string, lookAgainAt: string | null): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  const [lookAgain, setLookAgain] = useState("");
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim() !== "") onTable(reason.trim(), lookAgain === "" ? null : lookAgain);
      }}
    >
      <input
        className="field"
        aria-label={`Why table ${title}`}
        placeholder="Why not now?"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <input
        className="field"
        type="date"
        aria-label="Look again on"
        value={lookAgain}
        onChange={(event) => setLookAgain(event.target.value)}
      />
      <button type="submit" className="btn" data-primary="true" disabled={reason.trim() === ""}>
        Table it
      </button>
      <button type="button" className="btn" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
