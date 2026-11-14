import { Markdown } from "../ui/Markdown.tsx";
import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DragProps } from "../../hooks/useDragOrder.ts";
import { openEntity } from "../../lib/router.ts";
import { LineMeta } from "./LineMeta.tsx";

const ANSWER_STATUS: Readonly<Record<LineHome["answers"][number]["status"], string>> = {
  not_picked_up: "Not picked up yet.",
  picked_up: "Picked up.",
  carried_out: "Carried out.",
  wake_failed: "Its agent could not be woken.",
};

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
  /** In Reorder mode, how the line is dragged onto another. */
  drag?: DragProps;
}

/** A line being worked on: its place in the order, who is on it, its headline, and what it needs from you. */
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
  return (
    <article className="home-line" aria-label={line.title} data-selected={focused} {...drag}>
      <div className="home-line-head">
        <span className="home-line-num">{index}</span>
        <button type="button" className="home-line-title" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        {reorder}
      </div>
      <LineMeta {...(crew === undefined ? {} : { crew })} {...(details === undefined ? {} : { details })} />
      {line.headline === null ? null : (
        <p className="home-headline">
          <Markdown text={line.headline} inline />
        </p>
      )}
      {(details?.answers ?? []).map((answer) => (
        <p key={answer.ref} className="home-answer muted">
          You answered {answer.ref}, {answer.title}: {answer.answer}. {ANSWER_STATUS[answer.status]}
        </p>
      ))}
      {children}
    </article>
  );
}
