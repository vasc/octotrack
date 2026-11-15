import { Actions } from "../ui/Actions.tsx";
import { Button } from "../ui/Button.tsx";
import type { Line } from "@octotrack/core/schemas";

/**
 * The choices a proposal has, numbered for the keys, the recommended one filled and the rest words: Start, Up next, Table, Fold into when
 * there is a line to fold into, and Not a line; or Drop for a line back from tabled, since it was a line.
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
}) {
  const is = (placement: NonNullable<Line["recommendation"]>) => recommended === placement;
  const variant = (placement: NonNullable<Line["recommendation"]>) => (is(placement) ? "primary" : "plain");
  const last = canFold ? 5 : 4;
  return (
    <Actions>
      <Button aria-label={`Start ${title}`} choice={1} variant={variant("start")} onClick={onStart}>
        Start
      </Button>
      <Button aria-label={`Up next ${title}`} choice={2} variant={variant("up_next")} onClick={onQueue}>
        Up next
      </Button>
      <Button aria-label={`Table ${title}`} choice={3} variant={variant("table")} onClick={onTable}>
        Table
      </Button>
      {canFold ? (
        <Button aria-label={`Fold ${title}`} choice={4} variant={variant("fold")} onClick={onFold}>
          Fold into
        </Button>
      ) : null}
      {fromTable ? (
        <Button variant="quiet" aria-label={`Drop ${title}`} choice={last} onClick={onDrop}>
          Drop
        </Button>
      ) : (
        <Button variant="quiet" aria-label={`Not a line: ${title}`} choice={last} onClick={onReject}>
          Not a line
        </Button>
      )}
    </Actions>
  );
}
