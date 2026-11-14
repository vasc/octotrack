import { useState } from "react";

/** Asks why a line waits before tabling it: a tabled line always says why. */
export function TableForm({
  title,
  onTable,
  onCancel,
}: {
  title: string;
  onTable(reason: string): void;
  onCancel(): void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim() !== "") onTable(reason.trim());
      }}
    >
      <input
        className="field"
        aria-label={`Why table ${title}`}
        placeholder="Why not now?"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
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
