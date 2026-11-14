import type { Line, LineCrew } from "@octotrack/core/schemas";
import { useState } from "react";
import { crewText, recommendationText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { RefLink } from "../ui/RefLink.tsx";
import { TableForm } from "./TableForm.tsx";

export type LineMove = "start" | "queue" | "done" | "reject";

export interface LineRowProps {
  line: Line;
  /** Who is on it; none when nobody is or ever needed to be. */
  crew?: LineCrew;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove(ref: string, move: LineMove): void;
  onTable(ref: string, reason: string): void;
  onOrder(ref: string, direction: "up" | "down"): void;
}

/** The buttons each state offers: only moves the server allows from there. */
const ACTIONS: Readonly<Record<Line["state"], readonly (readonly [LineMove, string])[]>> = {
  proposed: [
    ["start", "Start"],
    ["queue", "Queue"],
    ["reject", "Not a line"],
  ],
  working: [
    ["queue", "Queue"],
    ["done", "Done"],
  ],
  up_next: [["start", "Start"]],
  tabled: [
    ["start", "Start"],
    ["queue", "Queue"],
  ],
  done: [],
  dropped: [],
};

export function LineRow({ line, crew, canMoveUp, canMoveDown, onMove, onTable, onOrder }: LineRowProps) {
  const [tabling, setTabling] = useState(false);
  const advice = recommendationText(line);
  const canTable = line.state !== "tabled" && line.state !== "done" && line.state !== "dropped";
  return (
    <div className="row">
      <RefLink value={line.ref} />
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        <div className="row-sub">
          {line.repos.length === 0 ? null : <span>{line.repos.join(", ")}</span>}
          {crewText(crew).map((words) => (
            <span key={words}>{words}</span>
          ))}
          {advice === null ? null : <span>{advice}</span>}
          {line.recommendationWhy === null ? null : <span>{line.recommendationWhy}</span>}
          {line.fromRef === null ? null : <span>from before ({line.fromRef})</span>}
          {line.tabledReason === null ? null : <span>{line.tabledReason}</span>}
          {line.lookAgainAt === null ? null : <span>look again {line.lookAgainAt.slice(0, 10)}</span>}
        </div>
        {tabling ? (
          <TableForm
            title={line.title}
            onTable={(reason) => {
              onTable(line.ref, reason);
              setTabling(false);
            }}
            onCancel={() => setTabling(false)}
          />
        ) : null}
      </div>
      <button
        type="button"
        className="btn"
        aria-label={`Move ${line.title} up`}
        disabled={!canMoveUp}
        onClick={() => onOrder(line.ref, "up")}
      >
        ↑
      </button>
      <button
        type="button"
        className="btn"
        aria-label={`Move ${line.title} down`}
        disabled={!canMoveDown}
        onClick={() => onOrder(line.ref, "down")}
      >
        ↓
      </button>
      {ACTIONS[line.state].map(([move, label]) => (
        <button
          key={move}
          type="button"
          className="btn"
          aria-label={`${label} ${line.title}`}
          onClick={() => onMove(line.ref, move)}
        >
          {label}
        </button>
      ))}
      {canTable ? (
        <button
          type="button"
          className="btn"
          aria-label={`Table ${line.title}`}
          onClick={() => setTabling(true)}
        >
          Table
        </button>
      ) : null}
    </div>
  );
}
