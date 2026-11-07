import type { DecisionOption } from "@octotrack/core/schemas";
import { Badge } from "../ui/Badge.tsx";

export interface DecisionOptionsProps {
  options: readonly DecisionOption[];
  recommendation: string | null;
  chosen: string | null;
  onChoose(key: string): void;
}

export function DecisionOptions({ options, recommendation, chosen, onChoose }: DecisionOptionsProps) {
  if (options.length === 0) return null;
  return (
    <div className="options">
      {options.map((option, index) => (
        <button
          type="button"
          key={option.key}
          className="option"
          aria-pressed={chosen === option.key}
          onClick={() => onChoose(option.key)}
        >
          <kbd>{index + 1}</kbd>
          <span className="option-label">{option.label}</span>
          {option.description === "" ? null : <span className="option-desc">{option.description}</span>}
          {option.key === recommendation ? <Badge tone="attention">recommended</Badge> : null}
        </button>
      ))}
    </div>
  );
}
