import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
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
 * finishes it, and Start, which opens its Start sheet.
 */
export function UpNextRow({
  index,
  line,
  crew,
  details,
  handle,
  focused = false,
  drop,
  onStart,
}: {
  index: number;
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Its handle: drag it onto another line, or open it to move the line. */
  handle?: ReactNode;
  focused?: boolean;
  /** Where another line can be dropped, to land before this one. */
  drop?: DropTarget;
  onStart(ref: string): void;
}) {
  const scoping =
    details === undefined || details.scopedSteps === 0
      ? "not scoped yet"
      : `scoped: ${details.scopedSteps} step${details.scopedSteps === 1 ? "" : "s"}`;
  return (
    <li
      className="next-row"
      aria-label={line.title}
      data-selected={focused}
      aria-current={focused ? "true" : undefined}
      data-focus-ref={lineFocusRef(line.ref)}
      tabIndex={-1}
      {...drop}
    >
      <span className="line-gutter">{handle}</span>
      <span className="line-num">{index}</span>
      <span className="next-row-text">
        <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        <span className="line-facts">
          {details === undefined ? null : <span> · {heldText(details.held)}</span>}
          {details === undefined || details.reconfirming === 0 ? null : (
            <span> · {details.reconfirming} re-confirming</span>
          )}
          <span> · {scoping}</span>
          {line.doneWhenProposal === null ? null : <span> · done when changed</span>}
          {crewText(crew).map((words) => (
            <span key={words}> · {words}</span>
          ))}
        </span>
        {line.doneWhen === "" ? null : (
          <span className="next-row-done">
            Done when <Markdown text={line.doneWhen} inline />
          </span>
        )}
      </span>
      <button
        type="button"
        className="btn"
        aria-label={`Start ${line.title}`}
        onClick={() => onStart(line.ref)}
      >
        Start
      </button>
    </li>
  );
}
