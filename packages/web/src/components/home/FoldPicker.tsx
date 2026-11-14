import type { Line } from "@octotrack/core/schemas";

/**
 * Fold into: the open lines a proposal could join, as numbered buttons, never a select an arrow key could change. The
 * number keys pick one while the proposal has focus.
 */
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
    <fieldset className="choice-group">
      <legend className="muted">Fold {title} into</legend>
      {targets.map((target, index) => (
        <button
          key={target.ref}
          type="button"
          // biome-ignore lint/a11y/noAutofocus: opened to choose one, so the first choice takes the cursor
          autoFocus={index === 0}
          className="btn"
          aria-label={`Fold ${title} into ${target.title}`}
          data-choice={index < 9 ? String(index + 1) : undefined}
          onClick={() => onFold(target.ref)}
        >
          {target.ref} {target.title}
        </button>
      ))}
      <button type="button" className="btn" data-quiet="true" onClick={onCancel}>
        Cancel
      </button>
    </fieldset>
  );
}
