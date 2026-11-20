import type { Line } from "@octotrack/core/schemas";
import { useState } from "react";
import { sinceText } from "../../lib/format.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { FoldPicker } from "../home/FoldPicker.tsx";
import { TableForm } from "../lines/TableForm.tsx";
import { Facts } from "../ui/Facts.tsx";
import { Item } from "../ui/Item.tsx";
import { Markdown } from "../ui/Markdown.tsx";
import { Code, Note } from "../ui/Note.tsx";
import { type Option, Options } from "../ui/Options.tsx";
import { Pairs } from "../ui/Pairs.tsx";

type Move = "start" | "up_next" | "fold" | "table" | "reject" | "drop";

/**
 * A proposed line opened on For you: who proposed it and why now, then its moves numbered as a question's answers, the
 * one its agent recommends first with its reason. Fold and Table ask what they need in place.
 */
export function ProposalItem({
  line,
  foldTargets,
  lastUpNext,
  origin,
  busy,
  onStart,
  onQueue,
  onTable,
  onFold,
  onReject,
  onDrop,
  alsoIn = null,
}: {
  line: Line;
  /** Lines it could fold into: those still open. */
  foldTargets: readonly Line[];
  /** The last line up next, which Up next puts it after. */
  lastUpNext: string | null;
  /** For a line made from a plan branch: "branch of L-1, holds up its step 3". */
  origin: string | null;
  /** A move of it waits with Undo. */
  busy: boolean;
  onStart(ref: string): void;
  onQueue(ref: string): void;
  onTable(ref: string, reason: string | null, lookAgainAt: string | null): void;
  onFold(ref: string, into: string): void;
  onReject(ref: string): void;
  onDrop(ref: string): void;
  /** The other view an urgent proposal is in, named where it is open: Urgent's in To accept, and the other way. */
  alsoIn?: string | null;
}) {
  const [mode, setMode] = useState<"table" | "fold" | null>(null);
  const [picked, setPicked] = useState<Move | null>(null);
  const fromTable = line.tabledReason !== null;
  const recommended = fromTable ? null : line.recommendation;
  const moves: Option[] = [
    {
      key: "start",
      label: "Start it now",
      description: "It joins Working on, and an agent is found to own it.",
    },
    {
      key: "up_next",
      label: "Up next",
      description: `It waits its turn${lastUpNext === null ? "" : `, after ${lastUpNext}`}.`,
    },
    ...(foldTargets.length === 0
      ? []
      : [
          {
            key: "fold",
            label: "Fold into a line…",
            description: "It becomes part of a line already there.",
          },
        ]),
    { key: "table", label: "Table it…", description: "Set aside, with a reason and a date to look again." },
    fromTable
      ? { key: "drop", label: "Drop it", description: "It was a line; it is closed, its history kept." }
      : { key: "reject", label: "Not a line", description: "Turned down; its agent is told." },
  ];
  // The recommended move comes first; its reason is said once, as Why now.
  const ordered = [
    ...moves.filter((move) => move.key === recommended),
    ...moves.filter((move) => move.key !== recommended),
  ].map((move) => (move.key === recommended ? { ...move, recommended: true } : move));
  const pick = (key: string) => {
    switch (key) {
      case "start":
        setPicked("start");
        onStart(line.ref);
        return;
      case "up_next":
        setPicked("up_next");
        onQueue(line.ref);
        return;
      case "fold":
        setMode("fold");
        return;
      case "table":
        setMode("table");
        return;
      case "reject":
        setPicked("reject");
        onReject(line.ref);
        return;
      case "drop":
        setPicked("drop");
        onDrop(line.ref);
        return;
    }
  };
  return (
    <Item
      label={line.title}
      tone={line.urgentReason === null ? "needs" : "stuck"}
      kind={
        <Facts>
          {line.urgentReason === null ? "Proposed line" : URGENT_REASON[line.urgentReason]}
          {line.proposedBy === null ? null : `by ${line.proposedBy}`}
          <Code>{line.ref}</Code>
          {line.repos.join(", ")}
          {origin}
          {sinceText(line.createdAt)}
        </Facts>
      }
      title={line.title}
      answerLabel="Where it goes"
      answer={
        mode === "fold" ? (
          <FoldPicker
            title={line.title}
            targets={foldTargets}
            onFold={(into) => {
              setMode(null);
              setPicked("fold");
              onFold(line.ref, into);
            }}
            onCancel={() => setMode(null)}
          />
        ) : mode === "table" ? (
          <TableForm
            title={line.title}
            onTable={(reason, lookAgainAt) => {
              setMode(null);
              setPicked("table");
              onTable(line.ref, reason, lookAgainAt);
            }}
            onCancel={() => setMode(null)}
          />
        ) : (
          <>
            <Options options={ordered} onPick={pick} chosen={busy ? (picked ?? undefined) : undefined} />
            {alsoIn === null ? null : (
              <Note>It is also in {alsoIn}: placing it here takes it out of both.</Note>
            )}
          </>
        )
      }
    >
      <Pairs
        pairs={[
          [
            "Done when",
            line.doneWhen.trim() === "" ? null : <Markdown key="done" text={line.doneWhen} inline />,
          ],
          [
            fromTable ? "Tabled" : "Why now",
            fromTable ? (
              line.tabledReason
            ) : line.recommendationWhy === null ? null : (
              <Markdown key="why" text={line.recommendationWhy} inline />
            ),
          ],
        ]}
      />
    </Item>
  );
}
