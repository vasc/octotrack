import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DragProps } from "../../hooks/useDragOrder.ts";
import { crewText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { Markdown } from "../ui/Markdown.tsx";
import { lineFocusRef } from "../../lib/focus.ts";

function heldText(held: LineHome["held"]): string {
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? "nothing held" : `${parts.join(" and ")} held`;
}

/**
 * A line up next, one row of the up-next card: its place in the order, what it holds, how far scoping got, what
 * finishes it, and Start, which opens the Start sheet (Start…) when the line holds something to look at first.
 */
export function UpNextRow({
  index,
  line,
  crew,
  details,
  reorder,
  focused = false,
  drag,
  onStart,
}: {
  index: number;
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  reorder?: ReactNode;
  focused?: boolean;
  drag?: DragProps;
  onStart(ref: string): void;
}) {
  const scoping =
    details === undefined || details.scopedSteps === 0
      ? "not scoped yet"
      : `scoped: ${details.scopedSteps} step${details.scopedSteps === 1 ? "" : "s"}`;
  // In Reorder mode a line is one row: its number, its title and the buttons that move it.
  const compact = reorder !== undefined && reorder !== null;
  const holds =
    details !== undefined &&
    (details.held.questions > 0 || details.held.tasks > 0 || line.doneWhenProposal !== null);
  return (
    <li
      className="next-row"
      aria-label={line.title}
      data-selected={focused}
      data-focus-ref={lineFocusRef(line.ref)}
      tabIndex={-1}
      {...drag}
    >
      <span className="line-handle" aria-hidden="true" title="Drag to reorder">
        ⋮⋮
      </span>
      <span className="line-num">{index}</span>
      <span className="next-row-text">
        <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        {compact ? null : (
          <span className="line-facts">
            {details === undefined ? null : <span> · {heldText(details.held)}</span>}
            <span> · {scoping}</span>
            {line.doneWhenProposal === null ? null : <span> · done when changed</span>}
            {crewText(crew).map((words) => (
              <span key={words}> · {words}</span>
            ))}
          </span>
        )}
        {compact || line.doneWhen === "" ? null : (
          <span className="next-row-done">
            Done when <Markdown text={line.doneWhen} inline />
          </span>
        )}
      </span>
      {reorder}
      {compact ? null : (
        <button
          type="button"
          className="btn"
          aria-label={`Start ${line.title}`}
          onClick={() => onStart(line.ref)}
        >
          {holds ? "Start…" : "Start"}
        </button>
      )}
    </li>
  );
}
