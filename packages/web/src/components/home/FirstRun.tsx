import type { Line } from "@octotrack/core/schemas";
import { EmptyState } from "../ui/states.tsx";

/**
 * Before anything is placed: the lines agents proposed from what was there before, accepted where they recommend in
 * one choice, with Undo; or, with nothing proposed yet, how agents start proposing.
 */
export function FirstRun({
  proposals,
  onAccept,
}: {
  proposals: readonly Line[];
  onAccept(refs: string[]): void;
}) {
  const placeable = proposals.filter(
    (line) => line.recommendation !== null && line.recommendation !== "fold",
  );
  if (proposals.length === 0) {
    return (
      <EmptyState command="octo guide">
        No lines yet. Add one above, or point an agent at the guide and it will propose lines from its repo.
      </EmptyState>
    );
  }
  return (
    <div className="proposal" role="note" aria-label="First run">
      <p>
        <strong>Your agents proposed {proposals.length} lines</strong>, from what was there before and from
        their repos' open work. Each says where it should go and why, below.
      </p>
      {placeable.length === 0 ? null : (
        <div className="decision-actions">
          <button
            type="button"
            className="btn"
            data-primary="true"
            onClick={() => onAccept(placeable.map((line) => line.ref))}
          >
            Accept {placeable.length} recommended placements
          </button>
        </div>
      )}
    </div>
  );
}
