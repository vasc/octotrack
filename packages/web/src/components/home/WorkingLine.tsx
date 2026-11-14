import { Markdown } from "../ui/Markdown.tsx";
import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { openEntity } from "../../lib/router.ts";
import { LineMeta } from "./LineMeta.tsx";

export interface WorkingLineProps {
  index: number;
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Reorder controls, shown in Reorder mode. */
  reorder?: ReactNode;
  /** What waits on the developer, and Step in. */
  children?: ReactNode;
}

/** A line being worked on: its place in the order, who is on it, its headline, and what it needs from you. */
export function WorkingLine({ index, line, crew, details, reorder, children }: WorkingLineProps) {
  return (
    <article className="home-line" aria-label={line.title}>
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
      {line.doneProposal === null ? null : (
        <p className="home-headline">
          <strong>Proposed done:</strong> {line.doneProposal}
        </p>
      )}
      {children}
    </article>
  );
}
