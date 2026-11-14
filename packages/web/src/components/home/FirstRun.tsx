import type { Line } from "@octotrack/core/schemas";
import { EmptyState } from "../ui/states.tsx";

/**
 * Before anything is placed: the lines agents proposed from what was there before, accepted where they recommend in
 * one choice, with Undo; or, with nothing proposed yet, how agents start proposing.
 */
export function FirstRun({
  proposals,
  repos,
  onAccept,
}: {
  proposals: readonly Line[];
  /** How many repos the tracker knows. */
  repos: number;
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
        Your {repos} repo{repos === 1 ? "" : "s"} have no lines yet. Agents with each repo propose real lines
        from their open issues, and old milestones arrive as candidates, shown here as they come. Each comes
        with a recommended placement and why, so you accept them all at once and change only the ones you
        disagree with.
      </p>
      {placeable.length === 0 ? null : (
        <div className="question-actions">
          <button
            type="button"
            className="btn"
            data-primary="true"
            onClick={() => onAccept(placeable.map((line) => line.ref))}
          >
            Accept recommended placements
          </button>
          <span className="muted">with Undo</span>
        </div>
      )}
    </div>
  );
}
