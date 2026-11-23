import type { Line } from "@octotrack/core/schemas";
import { Button } from "../ui/Button.tsx";
import { Notice } from "../ui/Notice.tsx";

const PLACED: Readonly<Record<NonNullable<Line["recommendation"]>, string>> = {
  start: "to start",
  up_next: "for up next",
  table: "to table",
  fold: "to fold",
};

/** Words joined as a sentence lists them: "a", "a and b", "a, b and c". */
function listed(parts: readonly string[]): string {
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`;
}

/**
 * Before anything is placed: how many lines agents proposed and where they recommend each goes, with one press to
 * place all that can be placed, with Undo; or, with nothing proposed yet, how lines arrive.
 */
export function FirstRun({
  proposals,
  onAccept,
  onNewLine,
}: {
  proposals: readonly Line[];
  onAccept(refs: string[]): void;
  onNewLine(): void;
}) {
  if (proposals.length === 0) {
    return (
      <Notice
        title="No lines yet"
        command="octo guide"
        action={
          <Button variant="primary" icon="plus" onClick={onNewLine}>
            New line
          </Button>
        }
      >
        Add one with New line, or point an agent at the guide: it proposes lines for its repo, and they arrive
        here to place.
      </Notice>
    );
  }
  const advised = proposals.filter((line) => line.recommendation !== null);
  // A fold needs the line to fold into, so it is placed one by one.
  const placeable = advised.filter((line) => line.recommendation !== "fold");
  const counts = (["start", "up_next", "table", "fold"] as const)
    .map(
      (placement) => [placement, advised.filter((line) => line.recommendation === placement).length] as const,
    )
    .filter(([, count]) => count > 0)
    .map(([placement, count]) => `${count} ${PLACED[placement]}`);
  const none = proposals.length - advised.length;
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
  return (
    <Notice
      title="Nothing is placed yet"
      action={
        placeable.length === 0 ? undefined : (
          <Button variant="primary" onClick={() => onAccept(placeable.map((line) => line.ref))}>
            Accept {placeable.length} recommendation{placeable.length === 1 ? "" : "s"}
          </Button>
        )
      }
    >
      {`Your agents proposed ${proposals.length} line${plural(proposals.length, "", "s")}. `}
      {advised.length === 0
        ? "None carries a recommendation."
        : `${advised.length} ${plural(advised.length, "carries", "carry")} a recommendation: ${listed(counts)}.`}
      {none === 0 ? "" : ` ${none} ${plural(none, "has", "have")} none.`}
      {advised.length === placeable.length
        ? ""
        : ` The ${advised.length - placeable.length} to fold ${plural(advised.length - placeable.length, "waits", "wait")} for you to pick the line ${plural(advised.length - placeable.length, "it goes", "they go")} into.`}
    </Notice>
  );
}
