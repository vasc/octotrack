import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { crewText } from "../../lib/lines.ts";
import { openEntity } from "../../lib/router.ts";
import { Button } from "../ui/Button.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";

function heldText(held: LineHome["held"]): string | null {
  const parts = [
    held.questions === 0 ? null : `${held.questions} question${held.questions === 1 ? "" : "s"}`,
    held.tasks === 0 ? null : `${held.tasks} task${held.tasks === 1 ? "" : "s"}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${parts.join(" and ")} held`;
}

/** A line up next, one row: its number, what it holds, how far scoping got, what finishes it, and Start. */
export function UpNextRow({
  line,
  crew,
  details,
  handle,
  focused = false,
  drop,
  onStart,
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
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      facts={
        <Facts>
          {details === undefined ? null : heldText(details.held)}
          {details === undefined || details.reconfirming === 0
            ? null
            : `${details.reconfirming} re-confirming`}
          {scoping}
          {line.doneWhenProposal === null ? null : "done when changed"}
          {crewText(crew)}
        </Facts>
      }
      {...(line.doneWhen === ""
        ? {}
        : {
            note: (
              <>
                Done when <Markdown text={line.doneWhen} inline />
              </>
            ),
          })}
      trailing={
        <Button aria-label={`Start ${line.title}`} onClick={() => onStart(line.ref)}>
          Start
        </Button>
      }
    />
  );
}
