import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { TableForm } from "../lines/TableForm.tsx";

export interface StepInProps {
  line: Line;
  /** What happened, and what would fix it. */
  reason: string;
  /** A start keeps failing or never took the line: Try now starts one again. */
  onRetry?: (ref: string) => void;
  onOwn(ref: string): void;
  onTable(ref: string, reason: string): void;
}

/** A working line no agent could be found for: what happened, and what the developer can do about it. */
export function StepIn({ line, reason, onRetry, onOwn, onTable }: StepInProps) {
  const [tabling, setTabling] = useState(false);
  return (
    <div className="step-in" role="note" aria-label={`Step in on ${line.title}`}>
      <p>
        <strong>Step in</strong> {reason}
      </p>
      {tabling ? (
        <TableForm
          title={line.title}
          onTable={(why) => {
            onTable(line.ref, why);
            setTabling(false);
          }}
          onCancel={() => setTabling(false)}
        />
      ) : (
        <div className="decision-actions">
          {onRetry === undefined ? null : (
            <button type="button" className="btn" data-primary="true" onClick={() => onRetry(line.ref)}>
              Try now
            </button>
          )}
          <button type="button" className="btn" onClick={() => setTabling(true)}>
            Table it…
          </button>
          <button type="button" className="btn" onClick={() => onOwn(line.ref)}>
            I'll own it
          </button>
        </div>
      )}
    </div>
  );
}
