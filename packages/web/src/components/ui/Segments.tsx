import { useId } from "react";

export interface Segment {
  key: string;
  label: string;
  /** What choosing it means, under its label; with it, the choices are tiles side by side. */
  description?: string;
}

/**
 * One choice of a few, all in view, as radio buttons drawn as tiles or pills under their name: where a new line goes,
 * when to look at a tabled one again. The one chosen is raised on the soft accent.
 */
export function Segments({
  label,
  choices,
  chosen,
  onChoose,
}: {
  label: string;
  choices: readonly Segment[];
  chosen: string;
  onChoose(key: string): void;
}) {
  const name = useId();
  const described = choices.some((choice) => choice.description !== undefined);
  return (
    <fieldset className="ui-segments">
      <legend className="ui-label">{label}</legend>
      <div className="ui-segments-row" data-described={described ? "true" : undefined}>
        {choices.map((choice) => (
          <label
            key={choice.key}
            className="ui-segment"
            data-checked={choice.key === chosen ? "true" : undefined}
          >
            <input
              type="radio"
              name={name}
              checked={choice.key === chosen}
              onChange={() => onChoose(choice.key)}
            />
            <span className="ui-segment-words">
              <span className="ui-segment-label">{choice.label}</span>
              {choice.description === undefined ? null : (
                <span className="ui-segment-description">{choice.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
