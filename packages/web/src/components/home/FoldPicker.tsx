import type { Line } from "@octotrack/core/schemas";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Label } from "../ui/Note.tsx";

/** Fold into: the open lines a proposal could join, one button each, numbered for the keys. */
export function FoldPicker({
  title,
  targets,
  onFold,
  onCancel,
}: {
  title: string;
  targets: readonly Line[];
  onFold(into: string): void;
  onCancel(): void;
}) {
  return (
    <>
      <Label>Fold into</Label>
      <Actions>
        {targets.map((target, index) => (
          <Button
            key={target.ref}
            // Opened to choose one, so the first choice takes the cursor.
            autoFocus={index === 0}
            aria-label={`Fold ${title} into ${target.title}`}
            choice={index < 9 ? index + 1 : undefined}
            onClick={() => onFold(target.ref)}
          >
            {target.title}
          </Button>
        ))}
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </Actions>
    </>
  );
}
