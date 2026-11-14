import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { LINE_STATE_LABEL } from "../../lib/lines.ts";
import { TableForm } from "../lines/TableForm.tsx";

export type LineChoice = "start" | "queue" | "done" | "drop" | "reject" | "own" | "not_yet";

export interface LineActionsProps {
  line: Line;
  /** Who winds down when the line moves away: its owner, when it has one. */
  owner?: string | null;
  onChoose(choice: LineChoice): void;
  onTable(reason: string, lookAgainAt: string | null): void;
  /** What waits on the developer on the line, which tabling holds. */
  held?: { questions: number; tasks: number };
}

/**
 * Where a line stands and how to move it, as E-Line draws it: its state, the moves that state allows (Done… asks
 * before it ends the line), the rarer ones under More, and what a move away does to its agents.
 */
export function LineActions({ line, owner = null, onChoose, onTable, held }: LineActionsProps) {
  const [mode, setMode] = useState<"table" | "done" | "more" | null>(null);
  const ended = line.state === "done" || line.state === "dropped";
  if (mode === "table") {
    return (
      <TableForm
        title={line.title}
        owner={owner}
        {...(held === undefined ? {} : { held })}
        onTable={(reason, lookAgainAt) => {
          onTable(reason, lookAgainAt);
          setMode(null);
        }}
        onCancel={() => setMode(null)}
      />
    );
  }
  if (mode === "done") {
    return (
      <div className="line-moves">
        <span>
          Done is final:{" "}
          {owner === null ? "its open work closes with it" : `${owner} closes out its open work`}.
        </span>
        <button
          type="button"
          className="btn"
          data-primary="true"
          onClick={() => {
            onChoose("done");
            setMode(null);
          }}
        >
          Done
        </button>
        <button type="button" className="btn" onClick={() => setMode(null)}>
          Cancel
        </button>
      </div>
    );
  }
  const move = (choice: LineChoice, label: string) => (
    <button type="button" className="btn" onClick={() => onChoose(choice)}>
      {label}
    </button>
  );
  return (
    <div className="line-moves">
      <span className="line-state">{LINE_STATE_LABEL[line.state]}</span>
      {line.state === "working" ? move("queue", "Move to up next") : null}
      {line.state === "up_next" || line.state === "tabled" || line.state === "proposed"
        ? move("start", "Start")
        : null}
      {line.state === "tabled" || line.state === "proposed" ? move("queue", "Up next") : null}
      {ended || line.state === "tabled" ? null : (
        <button type="button" className="btn" onClick={() => setMode("table")}>
          Table…
        </button>
      )}
      {line.state === "working" ? (
        <button type="button" className="btn" onClick={() => setMode("done")}>
          Done…
        </button>
      ) : null}
      {line.state === "proposed" ? move("reject", "Not a line") : null}
      {ended || line.state === "proposed" ? null : mode === "more" ? (
        move("drop", "Drop")
      ) : (
        <button
          type="button"
          className="btn"
          aria-label="More: drop this line"
          onClick={() => setMode("more")}
        >
          More
        </button>
      )}
      {line.state === "working" && owner !== null ? (
        <span className="line-moves-note">
          Up next, Table, Done…, Drop and I'll own it give {owner} 15 minutes to wind down. Table asks why;
          Done and Drop also close or fold what is open.
        </span>
      ) : null}
    </div>
  );
}
