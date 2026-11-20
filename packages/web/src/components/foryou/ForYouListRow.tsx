import type { Entry } from "../../lib/forYou.ts";
import { entryText } from "../../lib/forYou.ts";
import { URGENT_REASON } from "../../lib/lines.ts";
import { Button } from "../ui/Button.tsx";
import { Row } from "../ui/Row.tsx";

/** What an entry is, in a word or two, as its row says it. */
function kindOf(entry: Entry): string {
  switch (entry.item.kind) {
    case "question":
      return "Question";
    case "task":
      return "Task";
    case "proposal":
      return "Proposed line";
    case "stepin":
      return "Step in";
    case "done":
      return "Proposed done";
    case "done_when":
      return "New done when";
  }
}

/** A move a proposal's agent recommends that needs nothing more to make: its words. */
const QUICK: Readonly<Record<"start" | "up_next", string>> = { start: "Start", up_next: "Up next" };

/**
 * An entry of For you not open, as one row in its list: its number, what it is and its title, where it sits, one more
 * fact; a press opens it in place. A proposal whose agent recommends starting it or putting it up next carries that
 * move, so many are placed without opening each.
 */
export function ForYouListRow({
  entry,
  number,
  busy,
  onOpen,
  onMove,
}: {
  entry: Entry;
  number: number;
  /** A move of it waits with Undo. */
  busy: boolean;
  onOpen(ref: string): void;
  onMove(ref: string, move: "start" | "up_next"): void;
}) {
  const { where, title, note } = entryText(entry);
  const line = entry.line;
  const recommended =
    entry.item.kind === "proposal" &&
    line !== null &&
    line.tabledReason === null &&
    (line.recommendation === "start" || line.recommendation === "up_next")
      ? line.recommendation
      : null;
  const urgent =
    entry.item.kind === "question"
      ? entry.item.card.decision.urgentReason
      : entry.item.kind === "proposal"
        ? (line?.urgentReason ?? null)
        : null;
  const stuck = entry.item.kind === "stepin" || urgent !== null;
  return (
    <Row
      label={title}
      lead={String(number)}
      kind={urgent === null ? kindOf(entry) : URGENT_REASON[urgent]}
      tone={stuck ? "stuck" : "needs"}
      title={title}
      facts={where}
      {...(note === null ? {} : { note })}
      onPress={() => onOpen(entry.ref)}
      {...(recommended === null
        ? {}
        : {
            trailing: (
              <Button
                aria-label={`${QUICK[recommended]} ${title}`}
                busy={busy ? "Moving…" : undefined}
                onClick={() => onMove(entry.ref, recommended)}
              >
                {QUICK[recommended]}
              </Button>
            ),
          })}
    />
  );
}
