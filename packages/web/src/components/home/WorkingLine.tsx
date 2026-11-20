import type { Line, LineCrew, LineHome } from "@octotrack/core/schemas";
import type { ReactNode } from "react";
import type { DropTarget } from "../../hooks/useDragOrder.ts";
import { lineFocusRef, refOf, stepInRef } from "../../lib/focus.ts";
import { forYouPath } from "../../lib/forYou.ts";
import { waitsText } from "../../lib/lines.ts";
import { navigate } from "../../lib/router.ts";
import { List } from "../ui/List.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Note } from "../ui/Note.tsx";
import { Row } from "../ui/Row.tsx";
import { Waits } from "../ui/Waits.tsx";
import { AnswerStatus } from "./AnswerStatus.tsx";
import { LineMeta } from "./LineMeta.tsx";

interface WorkingLineProps {
  line: Line;
  crew?: LineCrew;
  details?: LineHome;
  /** Its number in the order, which drags it or opens its moves. */
  handle?: ReactNode;
  /** The line has focus, where the keys act. */
  focused?: boolean;
  /** Where another line can be dropped, to land before this one. */
  drop?: DropTarget;
  /** Its last move did not take: said under it, where it stayed. */
  notMoved?: boolean;
}

/**
 * A line being worked on, as one row that opens its page: its number, its title with who is on it and its step, its
 * headline, what became of its answers; at its end, how much waits on you there, which leads to For you, and Step in.
 */
export function WorkingLine({
  line,
  crew,
  details,
  handle,
  focused = false,
  drop,
  notMoved = false,
}: WorkingLineProps) {
  const answers = details?.answers ?? [];
  const forYou = details?.forYou ?? [];
  const waits = waitsText(forYou);
  const first = forYou[0];
  const stepIn = details?.stepIn === true;
  return (
    <Row
      label={line.title}
      focusRef={lineFocusRef(line.ref)}
      current={focused}
      {...(drop === undefined ? {} : { drop })}
      {...(handle === undefined ? {} : { lead: handle })}
      title={line.title}
      onPress={() => navigate(`/lines/${line.ref}`)}
      facts={
        <LineMeta
          owned={line.ownedBy !== null}
          {...(crew === undefined ? {} : { crew })}
          {...(details === undefined ? {} : { details })}
        />
      }
      {...(line.headline === null ? {} : { note: <Markdown text={line.headline} inline /> })}
      {...(stepIn || waits !== null
        ? {
            trailing: (
              <>
                {stepIn ? (
                  <Waits
                    label="Step in"
                    tone="warn"
                    href={forYouPath("toStepIn", stepInRef(line.ref))}
                    onGo={navigate}
                  />
                ) : null}
                {waits === null || first === undefined ? null : (
                  <Waits label={waits} href={forYouPath("all", refOf(first))} onGo={navigate} />
                )}
              </>
            ),
          }
        : {})}
    >
      {answers.length === 0 ? null : (
        <List>
          {answers.map((answer) => (
            <AnswerStatus key={answer.ref} answer={answer} />
          ))}
        </List>
      )}
      {notMoved ? <Note error>Not moved. The tracker did not answer; it is back where it was.</Note> : null}
    </Row>
  );
}
