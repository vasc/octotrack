import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { branchOfText, crewText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";

/** What a waiting line holds, per kind present: "1 question held", "1 question and 2 tasks held". */
function heldWords(held: LineHome["held"]): string | null {
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${parts.join(" and ")} held`;
}

/** A line up next, one row: its number, how far scoping got, what it holds, and Start. */
export function UpNextRow({
  line,
  crew,
  details,
  handle,
  focused = false,
  drop,
  onStart,
  notMoved = false,
}: {
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Its number in the order, which drags it or opens its moves. */
  handle?: ReactNode;
  focused?: boolean;
  /** Where another line can be dropped, to land before this one. */
  drop?: DropTarget;
  onStart(ref: string): void;
  /** Its last move did not take: said under it, where it stayed. */
  notMoved?: boolean;
}) {
  const scoping =
    details === undefined || details.scopedSteps === 0
      ? "not scoped"
      : `${details.scopedSteps} step${details.scopedSteps === 1 ? "" : "s"} scoped`;
  return (
    <Row
      label={line.title}
      focusRef={lineFocusRef(line.ref)}
      current={focused}
      {...(drop === undefined ? {} : { drop })}
      {...(handle === undefined ? {} : { lead: handle })}
      title={line.title}
      onPress={() => openEntity(line.ref)}
      facts={
        <Facts>
          {scoping}
          {details === undefined ? null : heldWords(details.held)}
          {details === undefined || details.reconfirming === 0
            ? null
            : `${details.reconfirming} re-confirming`}
          {line.doneWhenProposal === null ? null : "done when changed"}
          {branchOfText(details)}
          {crewText(crew)}
        </Facts>
      }
      trailing={
        <Button aria-label={`Start ${line.title}`} onClick={() => onStart(line.ref)}>
          Start
        </Button>
      }
    >
      {notMoved ? <Note error>Not moved. The tracker did not answer; it is back where it was.</Note> : null}
    </Row>
  );
}
