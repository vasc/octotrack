import { Markdown } from "../ui/Markdown.tsx";
import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import { crewText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";

function heldText(held: LineHome["held"]): string {
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? "nothing held" : `${parts.join(" and ")} held`;
}

/** A line up next: what it holds, how far scoping got, what finishes it, and Start. */
export function UpNextRow({
  index,
  line,
  crew,
  details,
  reorder,
  onStart,
}: {
  index: number;
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  reorder?: ReactNode;
  onStart(ref: string): void;
}) {
  const scoping =
    details === undefined || details.scopedSteps === 0
      ? "not scoped yet"
      : `scoped: ${details.scopedSteps} step${details.scopedSteps === 1 ? "" : "s"}`;
  return (
    <article className="home-row" aria-label={line.title}>
      <span className="home-line-num">{index}</span>
      <div className="row-stack">
        <button type="button" className="row-title" onClick={() => openEntity(line.ref)}>
          {line.title}
        </button>
        <p className="home-meta">
          {details === undefined ? null : <span>{heldText(details.held)}</span>}
          <span>{scoping}</span>
          {crewText(crew).map((words) => (
            <span key={words}>{words}</span>
          ))}
        </p>
        {line.doneWhen === "" ? null : (
          <p className="muted">
            Done when <Markdown text={line.doneWhen} inline />
          </p>
        )}
      </div>
      {reorder}
      <button
        type="button"
        className="btn"
        aria-label={`Start ${line.title}`}
        onClick={() => onStart(line.ref)}
      >
        Start
      </button>
    </article>
  );
}
