import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { TableForm } from "../lines/TableForm.tsx";

export interface StepInProps {
  line: Line;
  onOwn(ref: string): void;
  onTable(ref: string, reason: string): void;
}

/** A working line no agent could be found for: what happened, and what the developer can do about it. */
export function StepIn({ line, onOwn, onTable }: StepInProps) {
  const [tabling, setTabling] = useState(false);
  return (
    <div className="step-in" role="note" aria-label={`Step in on ${line.title}`}>
      <p>
        <strong>Step in</strong> No agent took {line.ref}, and none can be started for it yet: no start
        command is set on this machine.
      </p>
      {tabling ? (
        <TableForm
          title={line.title}
          onTable={(reason) => {
            onTable(line.ref, reason);
            setTabling(false);
          }}
          onCancel={() => setTabling(false)}
        />
      ) : (
        <div className="decision-actions">
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
