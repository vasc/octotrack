import type { ReactNode } from "react";

export interface Option {
  key: string;
  label: string;
  /** What happens if it is picked. */
  description?: ReactNode;
  recommended?: boolean;
}

/**
 * The answers to a question, one row each: its words, what happens, and the recommended one saying so. One press
 * answers; where there are keys, each carries the number that presses it.
 */
export function Options({
  options,
  onPick,
  firstChoice = 1,
}: {
  options: readonly Option[];
  onPick(key: string): void;
  /** The number the first answer's key presses, where several sets are numbered in one run. */
  firstChoice?: number;
}) {
  return (
    <div className="ui-options">
      {options.map((option, index) => (
        <button
          key={option.key}
          type="button"
          className="ui-option"
          aria-label={option.label}
          data-choice={String(firstChoice + index)}
          data-recommended={option.recommended === true ? "true" : undefined}
          onClick={() => onPick(option.key)}
        >
          <span className="ui-option-label">
            {option.label}
            {option.recommended === true ? <span className="ui-option-recommended">recommended</span> : null}
          </span>
          {option.description === undefined ? null : (
            <span className="ui-option-description">{option.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
