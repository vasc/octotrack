import type { ReactNode } from "react";

export interface Option {
  key: string;
  label: string;
  /** What happens if it is picked. */
  description?: ReactNode;
  recommended?: boolean;
  /** Why it is recommended, said inside it. */
  why?: ReactNode;
}

/**
 * The answers to a question, each a real control: its number on the label's baseline, its words, what happens, and the
 * recommended one saying so with its reason inside it. One press answers. Once one is chosen it shows a tick in place
 * of its number and the rest step back.
 */
export function Options({
  options,
  onPick,
  firstChoice = 1,
  chosen,
}: {
  options: readonly Option[];
  onPick(key: string): void;
  /** The number the first answer's key presses, where several sets are numbered in one run. */
  firstChoice?: number;
  /** The answer picked, while it waits to take effect. */
  chosen?: string | undefined;
}) {
  return (
    <ol className="ui-options">
      {options.map((option, index) => {
        const isChosen = chosen === option.key;
        return (
          <li key={option.key} className="ui-option-item">
            <button
              type="button"
              className="ui-option"
              aria-label={option.label}
              aria-pressed={chosen === undefined ? undefined : isChosen}
              data-choice={String(firstChoice + index)}
              data-recommended={option.recommended === true ? "true" : undefined}
              data-chosen={isChosen ? "true" : undefined}
              data-stepped={chosen !== undefined && !isChosen ? "true" : undefined}
              onClick={() => onPick(option.key)}
            >
              <span className="ui-option-key" aria-hidden="true">
                {isChosen ? "✓" : String(firstChoice + index)}
              </span>
              <span className="ui-option-words">
                <span className="ui-option-label">
                  {option.label}
                  {option.recommended === true ? (
                    <span className="ui-option-recommended">Recommended</span>
                  ) : null}
                </span>
                {option.description === undefined ? null : (
                  <span className="ui-option-description">{option.description}</span>
                )}
                {option.recommended === true && option.why !== undefined ? (
                  <span className="ui-option-why">
                    <b>Why:</b> {option.why}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
