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
  const many = proposals.length !== 1;
  return (
    <div className="proposal" role="note" aria-label="First run">
      {placeable.length === 0 ? (
        <p>
          Nothing is placed yet. The {many ? `${proposals.length} proposed lines` : "proposed line"} came from
          before lines, with no recommendation: place {many ? "each" : "it"} yourself, or wait for{" "}
          {many ? "their agents" : "its agent"} to propose a real line.
        </p>
      ) : (
        <>
          <p>
            {placeable.length} of the {proposals.length} proposed line{many ? "s" : ""}{" "}
            {placeable.length === 1 ? "carries" : "carry"} a recommended placement. Accept{" "}
            {placeable.length === 1 ? "it" : "them"} at once, then change any you disagree with.
          </p>
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
        </>
      )}
    </div>
  );
}
