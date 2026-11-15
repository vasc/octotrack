import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
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
  /** Its handle: drag it onto another line, or open it to move the line. */
  handle?: ReactNode;
  /** What waits on the developer, and Step in. */
  children?: ReactNode;
  /** The line itself has focus, reached with Shift J and K. */
  focused?: boolean;
  /** Where another line can be dropped, to land before this one. */
  drop?: DropTarget;
  /**
   * Folded: at a place the line is one row, its title then what it holds; folded on a phone it keeps its facts and
   * headline but not its answers.
   */
  fold?: "at" | "phone" | null;
}

/**
 * A line being worked on, as a card: its handle and place in the order, its title with who is on it and its plan step,
 * its headline and how many changes came after it, what became of its answers, and what it needs from you, indented
 * under it.
 */
export function WorkingLine({
  index,
  line,
  crew,
  details,
  handle,
  children,
  focused = false,
  drop,
  fold = null,
}: WorkingLineProps) {
  return (
    <li className="line-card-item">
      <article
        className="line-card"
        aria-label={line.title}
        data-selected={focused}
        aria-current={focused ? "true" : undefined}
        data-focus-ref={lineFocusRef(line.ref)}
        tabIndex={-1}
        {...drop}
      >
        <div className="line-card-head">
          <span className="line-gutter">{handle}</span>
          <span className="line-num">{index}</span>
          <div className="line-card-text">
            <h3 className="line-card-title">
              <button type="button" className="line-link" onClick={() => openEntity(line.ref)}>
                {line.title}
              </button>
            </h3>
            {fold === "at" || line.ownedBy === null ? null : <span className="line-facts"> · yours</span>}
            {fold === "at" ? null : (
              <LineMeta
                owned={line.ownedBy !== null}
                {...(crew === undefined ? {} : { crew })}
                {...(details === undefined ? {} : { details })}
              />
            )}
            {fold === "at" || line.headline === null ? null : (
              <div className="line-headline">
                <Markdown text={line.headline} inline />
                {details === undefined || details.sinceSummary === 0 ? null : (
                  <>
                    {" "}
                    <button type="button" className="since-link" onClick={() => openEntity(line.ref)}>
                      {details.sinceSummary} change{details.sinceSummary === 1 ? "" : "s"} since the summary
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {fold !== null
          ? null
          : (details?.answers ?? []).map((answer) => <AnswerStatus key={answer.ref} answer={answer} />)}
        {children}
      </article>
    </li>
  );
}
