import { Markdown } from "../ui/Markdown.tsx";
import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { TableForm } from "../lines/TableForm.tsx";

export type LineChoice = "start" | "queue" | "done" | "drop" | "reject" | "own" | "hand" | "not_yet";

export interface LineActionsProps {
  line: Line;
  onChoose(choice: LineChoice): void;
  onTable(reason: string, lookAgainAt: string | null): void;
  onDoneWhen(accept: boolean): void;
  /** The agent that owns the line, which the developer can stop from here. */
  owner?: string | null;
  onStopOwner?: (name: string) => void;
  /** Opened with t: tabling first. */
  tabling?: boolean;
}

const CHOICES: Readonly<Record<Line["state"], readonly (readonly [LineChoice, string])[]>> = {
  working: [
    ["queue", "Up next"],
    ["done", "Done"],
    ["drop", "Drop"],
  ],
  up_next: [
    ["start", "Start"],
    ["drop", "Drop"],
  ],
  tabled: [
    ["start", "Start"],
    ["queue", "Up next"],
    ["drop", "Drop"],
  ],
  proposed: [
    ["start", "Start"],
    ["queue", "Up next"],
    ["reject", "Not a line"],
  ],
  done: [],
  dropped: [],
};

/** Everything the developer can do with a line, from its panel: place it, finish it, own it, and answer its agents. */
export function LineActions({
  line,
  onChoose,
  onTable,
  onDoneWhen,
  owner = null,
  onStopOwner,
  tabling: startTabling = false,
}: LineActionsProps) {
  const [tabling, setTabling] = useState(startTabling);
  const live = line.state !== "done" && line.state !== "dropped";
  return (
    <div className="line-actions">
      {line.doneWhenProposal === null ? null : (
        <div className="proposal">
          <p>
            <strong>Proposed done when</strong> <Markdown text={line.doneWhenProposal} inline />
            {line.doneWhenProposedBy === null ? "" : ` (${line.doneWhenProposedBy})`}
          </p>
          <div className="decision-actions">
            <button type="button" className="btn" data-primary="true" onClick={() => onDoneWhen(true)}>
              Accept
            </button>
            <button type="button" className="btn" onClick={() => onDoneWhen(false)}>
              Keep the one there is
            </button>
          </div>
        </div>
      )}
      {line.doneProposal === null ? null : (
        <div className="proposal">
          <p>
            <strong>Proposed done</strong> <Markdown text={line.doneProposal} inline />
          </p>
          <div className="decision-actions">
            <button type="button" className="btn" data-primary="true" onClick={() => onChoose("done")}>
              It is done
            </button>
            <button type="button" className="btn" onClick={() => onChoose("not_yet")}>
              Not yet
            </button>
          </div>
        </div>
      )}
      {!live ? null : tabling ? (
        <TableForm
          title={line.title}
          onTable={(reason, lookAgainAt) => {
            onTable(reason, lookAgainAt);
            setTabling(false);
          }}
          onCancel={() => setTabling(false)}
        />
      ) : (
        <div className="decision-actions">
          {CHOICES[line.state].map(([choice, label]) => (
            <button key={choice} type="button" className="btn" onClick={() => onChoose(choice)}>
              {label}
            </button>
          ))}
          {line.state === "tabled" ? null : (
            <button type="button" className="btn" onClick={() => setTabling(true)}>
              Table…
            </button>
          )}
          {owner === null || onStopOwner === undefined ? null : (
            <button type="button" className="btn" onClick={() => onStopOwner(owner)}>
              Stop {owner}
            </button>
          )}
          {line.state !== "working" ? null : line.ownedBy === null ? (
            <button type="button" className="btn" onClick={() => onChoose("own")}>
              I'll own it
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => onChoose("hand")}>
              Hand to an agent
            </button>
          )}
        </div>
      )}
    </div>
  );
}
