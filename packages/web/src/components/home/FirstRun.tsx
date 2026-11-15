import type { Line } from "@octotrack/core/schemas";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { List } from "../ui/List.tsx";
import { Row } from "../ui/Row.tsx";
import { EmptyState } from "../ui/states.tsx";

/**
 * Before anything is placed: the lines agents proposed, placed where they recommend in one choice, with Undo; or,
 * with nothing proposed yet, the command that starts agents proposing.
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
  if (proposals.length === 0) return <EmptyState command="octo guide">No lines yet</EmptyState>;
  return (
    <List>
      <Row
        label="First run"
        title="Nothing placed yet"
        facts={`${placeable.length} of ${proposals.length} proposed carry a recommendation`}
      >
        {placeable.length === 0 ? null : (
          <Actions>
            <Button variant="primary" onClick={() => onAccept(placeable.map((line) => line.ref))}>
              Accept recommended placements
            </Button>
          </Actions>
        )}
      </Row>
    </List>
  );
}
