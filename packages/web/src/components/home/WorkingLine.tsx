import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DragProps } from "../../hooks/useDragOrder.ts";
import { openEntity } from "../../lib/router.ts";
import { AnswerStatus } from "./AnswerStatus.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { LineMeta } from "./LineMeta.tsx";
import { lineFocusRef } from "../../lib/focus.ts";

export interface WorkingLineProps {
  index: number;
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Reorder controls, shown in Reorder mode. */
  reorder?: ReactNode;
  /** What waits on the developer, and Step in. */
  children?: ReactNode;
  /** The line itself has focus, reached with Shift J and K. */
  focused?: boolean;
  /** How the line is dragged onto another. */
  drag?: DragProps;
}

/**
 * A line being worked on, as a card: its handle and place in the order, its title with who is on it and its plan step,
 * its headline, what became of its answers, and what it needs from you, indented under it.
 */
export function WorkingLine({
  index,
  line,
  crew,
  details,
  reorder,
  children,
  focused = false,
  drag,
}: WorkingLineProps) {
  // In Reorder mode a line is one row: its number, its title and the buttons that move it.
  const compact = reorder !== undefined && reorder !== null;
  return (
    <li className="line-card-item">
      <article
        className="line-card"
        aria-label={line.title}
        data-selected={focused}
        data-focus-ref={lineFocusRef(line.ref)}
        tabIndex={-1}
        {...drag}
      >
        <div className="line-card-head">
          <span className="line-handle" aria-hidden="true" title="Drag to reorder">
            ⋮⋮
          </span>
          <span className="line-num">{index}</span>
          <div className="line-card-text">
            <h3 className="line-card-title">
              <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
                {line.title}
              </button>
            </h3>
            {compact || line.ownedBy === null ? null : <span className="line-facts"> · yours</span>}
            {compact ? null : (
              <LineMeta
                {...(crew === undefined ? {} : { crew })}
                {...(details === undefined ? {} : { details })}
              />
            )}
            {compact || line.headline === null ? null : (
              <div className="line-headline">
                <Markdown text={line.headline} inline />
              </div>
            )}
          </div>
          {reorder}
        </div>
        {compact
          ? null
          : (details?.answers ?? []).map((answer) => <AnswerStatus key={answer.ref} answer={answer} />)}
        {compact ? null : children}
      </article>
    </li>
  );
}
