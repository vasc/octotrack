import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import { lineFocusRef } from "../../lib/focus.ts";
import { openEntity } from "../../lib/router.ts";
import { List } from "../ui/List.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { TextLink } from "../ui/RefLink.tsx";
import { Row } from "../ui/Row.tsx";
import { AnswerStatus } from "./AnswerStatus.tsx";
import { LineMeta } from "./LineMeta.tsx";

export interface WorkingLineProps {
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Its number in the order, which drags it or opens its moves. */
  handle?: ReactNode;
  /** What waits on the developer, and Step in. */
  children?: ReactNode;
  /** The line itself has focus, reached with Shift J and K. */
  focused?: boolean;
  /** Where another line can be dropped, to land before this one. */
  drop?: DropTarget;
  /** Folded: at a place the line is its title and what it holds; folded on a phone it keeps its facts and headline. */
  fold?: "at" | "phone" | null;
}

/**
 * A line being worked on, as one row: its number, its title with who is on it and its step, its headline, what
 * became of its answers, and under it what it needs from you.
 */
export function WorkingLine({
  line,
  crew,
  details,
  handle,
  children,
  focused = false,
  drop,
  fold = null,
}: WorkingLineProps) {
  const answers = fold !== null ? [] : (details?.answers ?? []);
  return (
    <Row
      label={line.title}
      focusRef={lineFocusRef(line.ref)}
      current={focused}
      {...(drop === undefined ? {} : { drop })}
      {...(handle === undefined ? {} : { lead: handle })}
      title={<TextLink onClick={() => openEntity(line.ref)}>{line.title}</TextLink>}
      {...(fold === "at"
        ? {}
        : {
            facts: (
              <LineMeta
                owned={line.ownedBy !== null}
                {...(crew === undefined ? {} : { crew })}
                {...(details === undefined ? {} : { details })}
              />
            ),
          })}
      {...(fold === "at" || line.headline === null ? {} : { note: <Markdown text={line.headline} inline /> })}
    >
      {answers.length === 0 ? null : (
        <List>
          {answers.map((answer) => (
            <AnswerStatus key={answer.ref} answer={answer} />
          ))}
        </List>
      )}
      {children}
    </Row>
  );
}
