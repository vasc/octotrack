import { useState } from "react";
import type { Line } from "@octotrack/core/schemas";
import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import { Menu, MenuAction } from "../ui/Menu.tsx";

type Move = "start" | "up_next" | "table" | "fold" | "reject" | "drop";

/** What the one button is named for a screen reader, before the line's title: "Fold Wall mount". */
const NAMED: Readonly<Record<Move, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold",
  reject: "Not a line:",
  drop: "Drop",
};

const WORD: Readonly<Record<Move, string>> = {
  start: "Start",
  up_next: "Up next",
  table: "Table",
  fold: "Fold into",
  reject: "Not a line",
  drop: "Drop",
};

/** What each move says while it waits with Undo. */
const BUSY: Readonly<Record<Move, string>> = {
  start: "Starting…",
  up_next: "Moving…",
  table: "Tabling…",
  fold: "Folding…",
  reject: "Turning it down…",
  drop: "Dropping…",
};

/**
 * The choices a proposal has: the recommended move as the one button, the rest under Other: Start, Up next, Table,
 * Fold into when there is a line to fold into, and Not a line; or Drop for a line back from tabled, since it was a
 * line. The button is 1 on the keys; the menu's items are numbered while it is open.
 */
export function ProposalChoices({
  title,
  recommended,
  canFold,
  fromTable,
  onStart,
  onQueue,
  onTable,
  onFold,
  onReject,
  onDrop,
  busy = false,
}: {
  title: string;
  recommended: Line["recommendation"];
  canFold: boolean;
  fromTable: boolean;
  onStart(): void;
  onQueue(): void;
  onTable(): void;
  onFold(): void;
  onReject(): void;
  onDrop(): void;
  /** A move of it waits with Undo: the button says which is on its way. */
  busy?: boolean;
}) {
  // Which move was pressed, so that the button says it is on its way while it waits.
  const [pressed, setPressed] = useState<Move | null>(null);
  const moves: Readonly<Record<Move, () => void>> = {
    start: onStart,
    up_next: onQueue,
    table: onTable,
    fold: onFold,
    reject: onReject,
    drop: onDrop,
  };
  const act = (move: Move) => {
    setPressed(move);
    moves[move]();
  };
  const all: readonly Move[] = [
    "start",
    "up_next",
    "table",
    ...(canFold ? (["fold"] as const) : []),
    fromTable ? "drop" : "reject",
  ];
  // A fold the line cannot make is no button: then Start leads.
  const main: Move = recommended === null || (recommended === "fold" && !canFold) ? "start" : recommended;
  const rest = all.filter((move) => move !== main);
  return (
    <Actions>
      <Button
        aria-label={busy ? BUSY[pressed ?? main] : `${NAMED[main]} ${title}`}
        choice={1}
        variant={recommended === null ? "plain" : "primary"}
        busy={busy ? BUSY[pressed ?? main] : undefined}
        onClick={() => act(main)}
      >
        {WORD[main]}
      </Button>
      <Menu
        disabled={busy}
        label={`Other moves for ${title}`}
        text="Other"
        menuLabel={`Other moves for ${title}`}
        align="start"
      >
        {(close) =>
          rest.map((move, index) => (
            <MenuAction
              key={move}
              choice={index + 2}
              autoFocus={index === 0}
              onSelect={() => {
                close();
                act(move);
              }}
            >
              {WORD[move]}
            </MenuAction>
          ))
        }
      </Menu>
    </Actions>
  );
}
