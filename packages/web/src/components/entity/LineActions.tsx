import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import type { LineChoice } from "../../lib/said.ts";
import { FoldPicker } from "../home/FoldPicker.tsx";
import { TableForm } from "../lines/TableForm.tsx";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Menu, MenuAction } from "../ui/Menu.tsx";

export interface LineActionsProps {
  line: Line;
  /** Who winds down when the line moves away: its owner, when it has one. */
  owner?: string | null;
  onChoose(choice: LineChoice): void;
  onTable(reason: string, lookAgainAt: string | null): void;
  /** What waits on the developer on the line, which tabling holds. */
  held?: { questions: number; tasks: number };
  /** For a proposal: the open lines it could fold into instead. */
  foldTargets?: readonly Line[];
  onFold?: (into: string) => void;
}

/** How to move a line: the moves its state allows in one row, the main one first, and the rarer ones under More. */
export function LineActions({
  line,
  owner = null,
  onChoose,
  onTable,
  held,
  foldTargets = [],
  onFold,
}: LineActionsProps) {
  const [mode, setMode] = useState<"table" | "fold" | null>(null);
  if (line.state === "done" || line.state === "dropped") return null;
  if (mode === "table") {
    return (
      <TableForm
        title={line.title}
        owner={owner}
        {...(held === undefined ? {} : { held })}
        onTable={(reason, lookAgainAt) => {
          onTable(reason, lookAgainAt);
          setMode(null);
        }}
        onCancel={() => setMode(null)}
      />
    );
  }
  if (mode === "fold" && onFold !== undefined) {
    return (
      <FoldPicker
        title={line.title}
        targets={foldTargets}
        onFold={(into) => {
          onFold(into);
          setMode(null);
        }}
        onCancel={() => setMode(null)}
      />
    );
  }
  const waiting = line.state === "up_next" || line.state === "tabled" || line.state === "proposed";
  const canFold = onFold !== undefined && foldTargets.length > 0;
  return (
    <Actions>
      {line.state === "working" ? <Button onClick={() => onChoose("done")}>Done</Button> : null}
      {line.state === "working" ? <Button onClick={() => onChoose("queue")}>Move to up next</Button> : null}
      {waiting ? (
        <Button variant="primary" onClick={() => onChoose("start")}>
          Start
        </Button>
      ) : null}
      {line.state === "tabled" || line.state === "proposed" ? (
        <Button onClick={() => onChoose("queue")}>Up next</Button>
      ) : null}
      {line.state === "tabled" ? null : <Button onClick={() => setMode("table")}>Table</Button>}
      {line.state === "proposed" && canFold ? (
        <Button onClick={() => setMode("fold")}>Fold into</Button>
      ) : null}
      {line.state === "proposed" ? <Button onClick={() => onChoose("reject")}>Not a line</Button> : null}
      {line.state === "proposed" ? null : (
        <Menu
          label="More: drop this line, fold it into another"
          text="More"
          icon="more"
          iconOnPhone
          menuLabel="More"
        >
          {(close) => (
            <>
              <MenuAction
                onSelect={() => {
                  close();
                  onChoose("drop");
                }}
              >
                Drop
              </MenuAction>
              {canFold ? (
                <MenuAction
                  onSelect={() => {
                    close();
                    setMode("fold");
                  }}
                >
                  Fold into another
                </MenuAction>
              ) : null}
            </>
          )}
        </Menu>
      )}
    </Actions>
  );
}
